import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {query} from '../config/database';
import {DeviceService} from './deviceService';
import {DwellingService} from './dwellingService';
import {
  ZerofyAuth,
  ZerofyAuthResponse,
  ZerofyDeviceList,
  ZerofyDeviceDetails,
  ZerofyDeviceStatus,
  ZerofyBatteryControl,
  DEVICE_TYPE_MAPPING,
  DEVICE_CAPABILITIES
} from '../types/zerofy';
import {
  Device,
  DeviceType,
  SolarInverterState,
  BatteryState,
  ApplianceState,
  MeterState,
  BatteryControlCommand
} from '../types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_key_change_in_production';
const ZEROFY_TOKEN_EXPIRES_IN = '24h';

export class ZerofyService {
  /**
   * Authenticate Zerofy app using email and password
   */
  static async authenticate(auth: ZerofyAuth): Promise<ZerofyAuthResponse> {
    // Validate email and password
    if (!auth.email || !auth.password) {
      throw new Error('Email and password are required');
    }

    // Find user by email
    const userResult = await query('SELECT user_id, email, password_hash FROM users WHERE email = $1', [auth.email]);

    if (userResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(auth.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate Zerofy-specific access token
    // Create non-expiring token for development/testing
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        clientId: auth.clientId ?? 'zerofy-app',
        scope: 'device:read device:status',
        type: 'zerofy_api'
      },
      JWT_SECRET
      // No expiresIn option = token never expires
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: null, // Token never expires
      scope: 'device:read device:status',
      userId: user.user_id,
      clientId: auth.clientId ?? 'zerofy-app'
    };
  }

  /**
   * Get all devices for Zerofy app
   */
  static async getDevices(userId: string): Promise<ZerofyDeviceList[]> {
    // Get all dwellings for the user
    const dwellings = await DwellingService.getUserDwellings(userId);

    const devices: ZerofyDeviceList[] = [];

    for (const dwelling of dwellings) {
      const dwellingDevices = await DeviceService.getDwellingDevices(dwelling.dwellingId);

      for (const device of dwellingDevices) {
        const zerofyDevice = this.transformDeviceToZerofyList(device, dwelling);
        devices.push(zerofyDevice);
      }
    }

    return devices;
  }

  /**
   * Get specific device details for Zerofy app
   */
  static async getDevice(deviceId: string, userId: string): Promise<ZerofyDeviceDetails | null> {
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      return null;
    }

    // Verify user has access to this device
    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      return null;
    }

    return this.transformDeviceToZerofyDetails(device, dwelling);
  }

  /**
   * Get device status for Zerofy app
   */
  static async getDeviceStatus(deviceId: string, userId: string): Promise<ZerofyDeviceStatus | null> {
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      return null;
    }

    // Verify user has access to this device
    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      return null;
    }

    return this.transformDeviceToZerofyStatus(device);
  }


  /**
   * Transform internal device to Zerofy device list format
   */
  private static transformDeviceToZerofyList(device: Device, dwelling: any): ZerofyDeviceList {
    const deviceType = DEVICE_TYPE_MAPPING[device.deviceType as keyof typeof DEVICE_TYPE_MAPPING];
    const capabilities = DEVICE_CAPABILITIES[deviceType as keyof typeof DEVICE_CAPABILITIES];
    const isOnline = device.state && typeof device.state === 'object' && 'isOnline' in device.state ? device.state.isOnline : true;

    return {
      deviceId: device.deviceId,
      deviceType,
      name: device.name ?? `${deviceType} ${device.deviceId.slice(0, 8)}`,
      status: isOnline ? 'online' : 'offline',
      location: {
        dwellingId: dwelling.dwellingId,
        dwellingName: `Dwelling ${dwelling.dwellingId.slice(0, 8)}`
      },
      capabilities: [...capabilities],
      lastSeen: device.updatedAt.toISOString()
    };
  }

  /**
   * Transform internal device to Zerofy device details format
   */
  private static transformDeviceToZerofyDetails(device: Device, dwelling: any): ZerofyDeviceDetails {
    const deviceType = DEVICE_TYPE_MAPPING[device.deviceType as keyof typeof DEVICE_TYPE_MAPPING];
    const capabilities = DEVICE_CAPABILITIES[deviceType as keyof typeof DEVICE_CAPABILITIES];
    const isOnline = device.state && typeof device.state === 'object' && 'isOnline' in device.state ? device.state.isOnline : true;

    return {
      deviceId: device.deviceId,
      deviceType,
      name: device.name ?? `${deviceType} ${device.deviceId.slice(0, 8)}`,
      status: isOnline ? 'online' : 'offline',
      location: {
        dwellingId: dwelling.dwellingId,
        dwellingName: `Dwelling ${dwelling.dwellingId.slice(0, 8)}`,
        coordinates: dwelling.location
      },
      capabilities: [...capabilities],
      configuration: device.config as Record<string, unknown>,
      currentState: device.state as Record<string, unknown>,
      lastUpdate: device.updatedAt.toISOString(),
      metadata: {
        manufacturer: 'HEMS Emulator',
        model: `${device.deviceType.toUpperCase()}-SIM`,
        firmwareVersion: '1.0.0',
        installationDate: device.createdAt.toString()
      }
    };
  }

  /**
   * Transform internal device to Zerofy device status format
   */
  private static transformDeviceToZerofyStatus(device: Device): ZerofyDeviceStatus {
    const deviceType = DEVICE_TYPE_MAPPING[device.deviceType as keyof typeof DEVICE_TYPE_MAPPING];
    const isOnline = device.state && typeof device.state === 'object' && 'isOnline' in device.state ? device.state.isOnline : true;

    let power = 0;
    let energy = 0;
    let batteryLevel = 0;

    // Extract power and energy based on device type
    switch (device.deviceType) {
      case DeviceType.SolarInverter: {
        const state = device.state as SolarInverterState;
        power = state.powerW;
        energy = state.energyTodayKwh;
        break;
      }
      case DeviceType.Battery: {
        const state = device.state as BatteryState;
        power = state.powerW;
        energy = 0; // Batteries don't have daily energy generation
        batteryLevel = state.batteryLevel * 100;
        break;
      }
      case DeviceType.Appliance: {
        const state = device.state as ApplianceState;
        power = state.powerW;
        energy = state.energyTodayKwh;
        break;
      }
      case DeviceType.Meter: {
        const state = device.state as MeterState;
        power = state.powerW;
        energy = state.energyImportTodayKwh;
        break;
      }
    }

    return {
      deviceId: device.deviceId,
      deviceType,
      status: isOnline ? 'online' : 'offline',
      power: Math.round(power),
      energy: Math.round(energy * 100) / 100, // Round to 2 decimal places
      batteryLevel: Math.round(batteryLevel),
      lastUpdate: device.updatedAt.toString(),
      metadata: {
        deviceType: device.deviceType,
        simulated: true
      }
    };
  }

  /**
   * Control battery charge/discharge mode for Zerofy app
   */
  static async controlBattery(deviceId: string, userId: string, control: ZerofyBatteryControl): Promise<void> {
    // Verify user has access to this device
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      throw new Error('Access denied');
    }

    // Verify device is a battery
    if (device.deviceType !== DeviceType.Battery) {
      throw new Error('Device is not a battery');
    }

    // Convert Zerofy control to internal command
    const command: BatteryControlCommand = {
      mode: control.mode,
      powerW: control.powerW
    };

    // Use existing device service method
    await DeviceService.controlBattery(deviceId, command);
  }

  /**
   * Verify Zerofy JWT token
   */
  static verifyZerofyToken(token: string): any {
    try {
      console.log('Verifying Zerofy token:', token);
      const result = jwt.verify(token, JWT_SECRET);
      console.log('Verifying Zerofy token:', result);
      return result
    } catch (error) {
      console.log(error);
      throw new Error('Invalid or expired Zerofy token');
    }
  }
} 