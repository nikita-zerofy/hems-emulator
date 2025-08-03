import { Router, Request, Response } from 'express';
import { ZerofyService } from '../services/zerofyService';
import { authenticateZerofyToken } from '../middleware/zerofyAuth';
import { ZerofyApiResponse, ZerofyAuth, ZerofyBatteryControlSchema, ZerofyApplianceControlSchema } from '../types/zerofy';
import { z } from 'zod';
import { createModuleLogger } from '../config/logger';

const router = Router();
const logger = createModuleLogger('zerofy-api');

/**
 * POST /api/zerofy/auth
 * Authenticate with email and password and get access token
 */
router.post('/auth', async (req: Request, res: Response) => {
  try {
    logger.info({ 
      email: req.body.email,
      clientId: req.body.clientId 
    }, 'Zerofy API authentication attempt');

    const authSchema = z.object({
      email: z.string().email(),
      password: z.string(),
      clientId: z.string().optional()
    });

    const authData: ZerofyAuth = authSchema.parse(req.body);
    const authResponse = await ZerofyService.authenticate(authData);

    logger.info({ 
      userId: authResponse.userId,
      email: req.body.email,
      clientId: req.body.clientId 
    }, 'Zerofy API authentication successful');

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

      logger.info({ 
        userId: req.zerofyUser.userId 
      }, 'Zerofy API: Fetching user devices');

      const devices = await ZerofyService.getDevices(req.zerofyUser.userId);

      logger.info({ 
        userId: req.zerofyUser.userId,
        deviceCount: devices.length 
      }, 'Zerofy API: Successfully fetched user devices');

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

      logger.info({ 
        userId: req.zerofyUser.userId,
        deviceId,
        command: req.body 
      }, 'Zerofy API: Device control command received');

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
        
        logger.info({ 
          userId: req.zerofyUser.userId,
          deviceId,
          command: controlCommand 
        }, 'Zerofy API: Battery control command executed successfully');

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
        
        logger.info({ 
          userId: req.zerofyUser.userId,
          deviceId,
          command: controlCommand 
        }, 'Zerofy API: Appliance control command executed successfully');

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