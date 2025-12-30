import { Router, Request, Response } from 'express';
import { ZerofyService } from '../services/zerofyService';
import { authenticateZerofyToken } from '../middleware/zerofyAuth';
import { ZerofyApiResponse, ZerofyAuth, ZerofyBatteryControlSchema, ZerofyApplianceControlSchema, ZerofyHotWaterControlSchema, ZerofyEVChargerControlSchema } from '../types/zerofy';
import { z } from 'zod';
import { logger } from '../config/logger';

const router = Router();

/**
 * POST /api/zerofy/auth
 * Authenticate with email and password and get access token
 */
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const authSchema = z.object({
      email: z.string().email(),
      password: z.string(),
      clientId: z.string().optional()
    });

    const authData: ZerofyAuth = authSchema.parse(req.body);
    const authResponse = await ZerofyService.authenticate(authData);

    const response: ZerofyApiResponse = {
      success: true,
      data: authResponse,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email,
      clientId: req.body.clientId 
    }, 'Zerofy API authentication failed');

    const response: ZerofyApiResponse = {
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: error instanceof Error ? error.message : 'Authentication failed'
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    return res.status(401).json(response);
  }
});

/**
 * GET /api/zerofy/devices
 * Get all devices for the authenticated user
 */
router.get('/devices', 
  authenticateZerofyToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.zerofyUser) {
        throw new Error('User not authenticated');
      }

      const devices = await ZerofyService.getDevices(req.zerofyUser.userId);

      const response: ZerofyApiResponse = {
        success: true,
        data: devices,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(200).json(response);
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.zerofyUser?.userId 
      }, 'Zerofy API: Failed to fetch devices');

      const response: ZerofyApiResponse = {
        success: false,
        error: {
          code: 'DEVICES_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch devices'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(500).json(response);
    }
  }
);

/**
 * GET /api/zerofy/devices/:deviceId
 * Get specific device details
 */
router.get('/devices/:deviceId',
  authenticateZerofyToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.zerofyUser) {
        throw new Error('User not authenticated');
      }

      const { deviceId } = req.params;
      const device = await ZerofyService.getDevice(deviceId, req.zerofyUser.userId);

      if (!device) {
        const response: ZerofyApiResponse = {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not found or access denied'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };

        return res.status(404).json(response);
      }

      const response: ZerofyApiResponse = {
        success: true,
        data: device,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error('Zerofy get device error:', error);

      const response: ZerofyApiResponse = {
        success: false,
        error: {
          code: 'DEVICE_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch device'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(500).json(response);
    }
  }
);

/**
 * GET /api/zerofy/devices/:deviceId/status
 * Get current device status
 */
router.get('/devices/:deviceId/status',
  authenticateZerofyToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.zerofyUser) {
        throw new Error('User not authenticated');
      }

      const { deviceId } = req.params;
      const deviceStatus = await ZerofyService.getDeviceStatus(deviceId, req.zerofyUser.userId);

      if (!deviceStatus) {
        const response: ZerofyApiResponse = {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not found or access denied'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };

        return res.status(404).json(response);
      }

      const response: ZerofyApiResponse = {
        success: true,
        data: deviceStatus,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error('Zerofy get device status error:', error);

      const response: ZerofyApiResponse = {
        success: false,
        error: {
          code: 'STATUS_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch device status'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(500).json(response);
    }
  }
);

/**
 * POST /api/zerofy/devices/:deviceId/control
 * Control device (battery charge/discharge mode or appliance on/off)
 */
router.post('/devices/:deviceId/control',
  authenticateZerofyToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.zerofyUser) {
        throw new Error('User not authenticated');
      }

      const { deviceId } = req.params;

      // Get device to determine type
      const device = await ZerofyService.getDevice(deviceId, req.zerofyUser.userId);
      if (!device) {
        const response: ZerofyApiResponse = {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not found or access denied'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(404).json(response);
      }

      if (device.deviceType === 'battery') {
        const controlCommand = ZerofyBatteryControlSchema.parse(req.body);
        await ZerofyService.controlBattery(deviceId, req.zerofyUser.userId, controlCommand);
        
        const response: ZerofyApiResponse = {
          success: true,
          data: {
            message: 'Battery control command executed successfully',
            deviceId,
            command: controlCommand
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(200).json(response);
      } else if (device.deviceType === 'appliance') {
        const controlCommand = ZerofyApplianceControlSchema.parse(req.body);
        await ZerofyService.controlAppliance(deviceId, req.zerofyUser.userId, controlCommand);
        
        const response: ZerofyApiResponse = {
          success: true,
          data: {
            message: 'Appliance control command executed successfully',
            deviceId,
            command: controlCommand
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(200).json(response);
      } else if (device.deviceType === 'hotWaterStorage') {
        const controlCommand = ZerofyHotWaterControlSchema.parse(req.body);
        await ZerofyService.controlHotWaterStorage(deviceId, req.zerofyUser.userId, controlCommand);

        const response: ZerofyApiResponse = {
          success: true,
          data: {
            message: 'Hot water storage control command executed successfully',
            deviceId,
            command: controlCommand
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(200).json(response);
      } else {
        const response: ZerofyApiResponse = {
          success: false,
          error: {
            code: 'DEVICE_NOT_CONTROLLABLE',
            message: `Device type '${device.deviceType}' is not controllable`
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(400).json(response);
      }
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.zerofyUser?.userId,
        deviceId: req.params.deviceId,
        command: req.body 
      }, 'Zerofy API: Device control command failed');

      const response: ZerofyApiResponse = {
        success: false,
        error: {
          code: 'CONTROL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to control device'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(400).json(response);
    }
  });

/**
 * POST /api/zerofy/devices/:deviceId/control/evcharger
 * Control EV charger (start/stop, set power)
 */
router.post('/devices/:deviceId/control/evcharger',
  authenticateZerofyToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.zerofyUser) {
        throw new Error('User not authenticated');
      }

      const { deviceId } = req.params;
      const device = await ZerofyService.getDevice(deviceId, req.zerofyUser.userId);

      if (!device) {
        const response: ZerofyApiResponse = {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not found or access denied'
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(404).json(response);
      }

      if (device.deviceType !== 'evCharger') {
        const response: ZerofyApiResponse = {
          success: false,
          error: {
            code: 'DEVICE_NOT_CONTROLLABLE',
            message: `Device type '${device.deviceType}' is not controllable via EV charger endpoint`
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        return res.status(400).json(response);
      }

      const controlCommand = ZerofyEVChargerControlSchema.parse(req.body);
      await ZerofyService.controlEVCharger(deviceId, req.zerofyUser.userId, controlCommand);

      const response: ZerofyApiResponse = {
        success: true,
        data: {
          message: 'EV charger control command executed successfully',
          deviceId,
          command: controlCommand
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(200).json(response);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.zerofyUser?.userId,
        deviceId: req.params.deviceId,
        command: req.body
      }, 'Zerofy API: EV charger control command failed');

      const response: ZerofyApiResponse = {
        success: false,
        error: {
          code: 'CONTROL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to control EV charger'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      return res.status(400).json(response);
    }
  }
);

/**
 * GET /api/zerofy/health
 * API health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  const response: ZerofyApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };

  return res.status(200).json(response);
});

export default router; 