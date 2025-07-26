import { Router, Request, Response } from 'express';
import { ZerofyService } from '../services/zerofyService';
import { authenticateZerofyToken } from '../middleware/zerofyAuth';
import { ZerofyApiResponse, ZerofyAuth } from '../types/zerofy';
import { z } from 'zod';

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
    console.error('Zerofy authentication error:', error);

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
      console.error('Zerofy get devices error:', error);

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