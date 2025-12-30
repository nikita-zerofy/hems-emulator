import {Router, Request, Response} from 'express';
import {DeviceService} from '../services/deviceService';
import {DwellingService} from '../services/dwellingService';
import {authenticateToken} from '../middleware/auth';
import {
  ApiResponse,
  DeviceType,
  BatteryControlCommandSchema,
  ApplianceControlCommandSchema,
  HotWaterStorageControlCommandSchema,
  EVChargerControlCommandSchema
} from '../types';
import {z} from 'zod';

const router = Router();

// All device routes require authentication
router.use(authenticateToken);

// Request validation schemas
const CreateDeviceSchema = z.object({
  deviceType: z.nativeEnum(DeviceType),
  name: z.string().optional(),
  config: z.unknown()
});

const UpdateDeviceConfigSchema = z.object({
  config: z.unknown()
});

/**
 * POST /dwellings/:dwellingId/devices
 * Add a new device to a dwelling
 */
router.post('/dwellings/:dwellingId/devices', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const {dwellingId} = req.params;
    const {deviceType, name, config} = CreateDeviceSchema.parse(req.body);

    // Verify user has access to the dwelling
    const hasAccess = await DwellingService.validateDwellingAccess(dwellingId, req.user.userId);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        error: 'Dwelling not found'
      } satisfies ApiResponse);
    }

    const device = await DeviceService.createDevice(dwellingId, deviceType, config, name);

    const response: ApiResponse = {
      success: true,
      data: device,
      message: 'Device created successfully'
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create device error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create device'
    };

    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
    }

    return res.status(400).json(response);
  }
});

/**
 * GET /devices/:deviceId
 * Get device details
 */
router.get('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const {deviceId} = req.params;

    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    // Verify user has access to the dwelling this device belongs to
    const hasAccess = await DwellingService.validateDwellingAccess(device.dwellingId, req.user.userId);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    const response: ApiResponse = {
      success: true,
      data: device
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get device error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve device'
    };

    return res.status(500).json(response);
  }
});

/**
 * PUT /devices/:deviceId
 * Update a device's configuration
 */
router.put('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const {deviceId} = req.params;
    const {config} = UpdateDeviceConfigSchema.parse(req.body);

    // Get device to verify access
    const existingDevice = await DeviceService.getDevice(deviceId);
    if (!existingDevice) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    // Verify user has access to the dwelling this device belongs to
    const hasAccess = await DwellingService.validateDwellingAccess(existingDevice.dwellingId, req.user.userId);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    const device = await DeviceService.updateDeviceConfig(deviceId, config);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    const response: ApiResponse = {
      success: true,
      data: device,
      message: 'Device updated successfully'
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Update device error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update device'
    };

    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
    }

    return res.status(400).json(response);
  }
});

/**
 * DELETE /devices/:deviceId
 * Remove a device
 */
router.delete('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const {deviceId} = req.params;

    // Get device to verify access
    const existingDevice = await DeviceService.getDevice(deviceId);
    if (!existingDevice) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    // Verify user has access to the dwelling this device belongs to
    const hasAccess = await DwellingService.validateDwellingAccess(existingDevice.dwellingId, req.user.userId);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    const deleted = await DeviceService.deleteDevice(deviceId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Device deleted successfully'
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Delete device error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete device'
    };

    return res.status(500).json(response);
  }
});

/**
 * GET /dwellings/:dwellingId/devices
 * Get all devices for a dwelling
 */
router.get('/dwellings/:dwellingId/devices', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const {dwellingId} = req.params;

    // Verify user has access to the dwelling
    const hasAccess = await DwellingService.validateDwellingAccess(dwellingId, req.user.userId);
    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        error: 'Dwelling not found'
      } satisfies ApiResponse);
    }

    const devices = await DeviceService.getDwellingDevices(dwellingId);

    const response: ApiResponse = {
      success: true,
      data: devices
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get dwelling devices error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve devices'
    };

    return res.status(500).json(response);
  }
});

/**
 * POST /devices/:deviceId/control
 * Control device (battery charge/discharge mode or appliance on/off)
 */
router.post('/devices/:deviceId/control', authenticateToken, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    // Get device to determine type
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    if (device.deviceType === 'battery') {
      const command = BatteryControlCommandSchema.parse(req.body);
      await DeviceService.controlBattery(deviceId, command);
      
      const response: ApiResponse = {
        success: true,
        message: 'Battery control command sent successfully'
      };
      return res.status(200).json(response);
    } else if (device.deviceType === 'appliance') {
      const command = ApplianceControlCommandSchema.parse(req.body);
      await DeviceService.controlAppliance(deviceId, command);
      
      const response: ApiResponse = {
        success: true,
        message: 'Appliance control command sent successfully'
      };
      return res.status(200).json(response);
    } else if (device.deviceType === DeviceType.HotWaterStorage) {
      const command = HotWaterStorageControlCommandSchema.parse(req.body);
      await DeviceService.controlHotWaterStorage(deviceId, command);

      const response: ApiResponse = {
        success: true,
        message: 'Hot water storage control command sent successfully'
      };
      return res.status(200).json(response);
    } else {
      return res.status(400).json({
        success: false,
        error: `Device type '${device.deviceType}' is not controllable`
      } satisfies ApiResponse);
    }
  } catch (error) {
    console.error('Device control error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to control device'
    };

    return res.status(400).json(response);
  }
});

/**
 * POST /devices/:deviceId/control/evcharger
 * Control EV charger (start/stop, set power)
 */
router.post('/devices/:deviceId/control/evcharger', authenticateToken, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId;

    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      } satisfies ApiResponse);
    }

    if (device.deviceType !== DeviceType.EVCharger) {
      return res.status(400).json({
        success: false,
        error: 'Device is not an EV charger'
      } satisfies ApiResponse);
    }

    const command = EVChargerControlCommandSchema.parse(req.body);
    await DeviceService.controlEVCharger(deviceId, command);

    return res.status(200).json({
      success: true,
      message: 'EV charger control command sent successfully'
    } satisfies ApiResponse);
  } catch (error) {
    console.error('EV charger control error:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to control EV charger'
    };

    return res.status(400).json(response);
  }
});

export default router; 