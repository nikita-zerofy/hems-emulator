import {DateTime} from 'luxon';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {query} from '../config/database';
import {DeviceService} from './deviceService';
import {DwellingService} from './dwellingService';
import {logger} from '../config/logger';
import {
  DEVICE_CAPABILITIES,
  DEVICE_TYPE_MAPPING,
  ZerofyApplianceControl,
  ZerofyAuth,
  ZerofyAuthResponse,
  ZerofyBatteryControl,
  ZerofyDeviceDetails,
  ZerofyDeviceList,
  ZerofyDeviceStatus,
  ZerofyEVControl,
  ZerofyHotWaterControl,
  ZerofyEVChargerControl
} from '../types/zerofy';
import {
  ApplianceConfig,
  ApplianceControlCommand,
  ApplianceState,
  BatteryControlCommand,
  BatteryState,
  Device,
  DeviceType,
  Dwelling,
  EVConfig,
  EVDrivingSchedule,
  MeterConfig,
  MeterState,
  SolarInverterState,
  HotWaterStorageState,
  EVState,
  EVChargerState,
  normalizeEVConfig
} from '../types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_key_change_in_production';
// const ZEROFY_TOKEN_EXPIRES_IN = '24h';

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

    return this.transformDeviceToZerofyStatus(device, dwelling.timeZone);
  }


  /**
   * Transform internal device to Zerofy device list format
   */
  private static transformDeviceToZerofyList(device: Device, dwelling: Dwelling): ZerofyDeviceList {
    const deviceType = DEVICE_TYPE_MAPPING[device.deviceType as keyof typeof DEVICE_TYPE_MAPPING];
    const capabilities = DEVICE_CAPABILITIES[deviceType as keyof typeof DEVICE_CAPABILITIES];
    const isOnline = device.state && typeof device.state === 'object' && 'isOnline' in device.state ? device.state.isOnline : true;
    const isEvAtHome = this.getIsEvAtHome(device, dwelling.timeZone);

    return {
      deviceId: device.deviceId,
      deviceType,
      name: device.name ?? `${deviceType} ${device.deviceId.slice(0, 8)}`,
      status: isOnline ? 'online' : 'offline',
      isEvAtHome,
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
  private static transformDeviceToZerofyDetails(device: Device, dwelling: Dwelling): ZerofyDeviceDetails {
    const deviceType = DEVICE_TYPE_MAPPING[device.deviceType as keyof typeof DEVICE_TYPE_MAPPING];
    const capabilities = DEVICE_CAPABILITIES[deviceType as keyof typeof DEVICE_CAPABILITIES];
    const isOnline = device.state && typeof device.state === 'object' && 'isOnline' in device.state ? device.state.isOnline : true;
    const isEvAtHome = this.getIsEvAtHome(device, dwelling.timeZone);
    const configuration = device.deviceType === DeviceType.EV
      ? normalizeEVConfig(device.config as EVConfig)
      : device.config as Record<string, unknown>;

    return {
      deviceId: device.deviceId,
      deviceType,
      name: device.name ?? `${deviceType} ${device.deviceId.slice(0, 8)}`,
      status: isOnline ? 'online' : 'offline',
      isEvAtHome,
      location: {
        dwellingId: dwelling.dwellingId,
        dwellingName: `Dwelling ${dwelling.dwellingId.slice(0, 8)}`,
        coordinates: dwelling.location
      },
      capabilities: [...capabilities],
      configuration,
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
  private static transformDeviceToZerofyStatus(device: Device, timeZone: string): ZerofyDeviceStatus {
    const deviceType = DEVICE_TYPE_MAPPING[device.deviceType as keyof typeof DEVICE_TYPE_MAPPING];
    const isOnline = device.state && typeof device.state === 'object' && 'isOnline' in device.state ? device.state.isOnline : true;
    const isEvAtHome = this.getIsEvAtHome(device, timeZone);

    let power = 0;
    let energy = 0;
    let batteryLevel = 0;
    let isEvAtHomeValue: boolean | undefined = isEvAtHome;
    let isOn: boolean | undefined = undefined;
    let waterTemperatureC: number | undefined = undefined;
    let targetTemperatureC: number | undefined = undefined;
    let isHotWaterBoostOn: boolean | undefined = undefined;
    let isCharging: boolean | undefined = undefined;
    let targetPowerW: number | undefined = undefined;

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
        isOn = state.isOn; // Include on/off state for appliances
        break;
      }
      case DeviceType.Meter: {
        const config = device.config as MeterConfig;
        const state = device.state as MeterState;
        power = state.powerW;
        energy = config.role === 'production' ? state.energyExportTodayKwh : state.energyImportTodayKwh;
        break;
      }
      case DeviceType.HotWaterStorage: {
        const state = device.state as HotWaterStorageState;
        power = state.power;
        energy = 0;
        waterTemperatureC = state.waterTemperatureC;
        targetTemperatureC = state.targetTemperatureC;
        isHotWaterBoostOn = state.isHotWaterBoostOn;
        break;
      }
      case DeviceType.EV: {
        const state = device.state as EVState;
        power = state.powerW;
        energy = state.energyTodayKwh;
        batteryLevel = state.batteryLevel * 100;
        isCharging = state.isCharging;
        break;
      }
      case DeviceType.EVCharger: {
        const state = device.state as EVChargerState;
        power = state.powerW;
        energy = state.energyTodayKwh;
        isCharging = state.isCharging;
        targetPowerW = state.targetPowerW;
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
      isEvAtHome: isEvAtHomeValue,
      isOn,
      waterTemperatureC,
      targetTemperatureC,
      isHotWaterBoostOn,
      isCharging,
      targetPowerW,
      lastUpdate: device.updatedAt.toString(),
      metadata: {
        deviceType: device.deviceType,
        role: device.deviceType === DeviceType.Meter
          ? (device.config as MeterConfig).role
          : device.deviceType === DeviceType.Appliance
            ? (device.config as ApplianceConfig).role
            : undefined,
        simulated: true
      }
    };
  }

  /**
   * Check whether the EV is currently at home.
   */
  private static getIsEvAtHome(device: Device, timeZone: string): boolean | undefined {
    if (device.deviceType !== DeviceType.EV) {
      return undefined;
    }

    const config = normalizeEVConfig(device.config as EVConfig);
    return !this.isDrivingNow(config, timeZone);
  }

  /**
   * Check whether any EV driving schedule is currently active.
   */
  private static isDrivingNow(config: EVConfig, timeZone: string): boolean {
    if (!config.drivingDischargePowerW || config.drivingDischargePowerW <= 0) {
      return false;
    }

    const now = DateTime.now().setZone(timeZone);
    const currentMinutes = now.hour * 60 + now.minute;

    return config.drivingSchedules.some((schedule) => this.isScheduleActive(schedule, currentMinutes));
  }

  /**
   * Check whether a schedule is active for the provided local minute.
   */
  private static isScheduleActive(schedule: EVDrivingSchedule, currentMinutes: number): boolean {
    const startMinutes = this.timeToMinutes(schedule.startTime);
    const endMinutes = this.timeToMinutes(schedule.endTime);

    if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
      return false;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  /**
   * Convert an HH:mm value into minutes since midnight.
   */
  private static timeToMinutes(value: string): number | null {
    const [hoursText, minutesText] = value.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
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
   * Control appliance on/off state for Zerofy app
   */
  static async controlAppliance(deviceId: string, userId: string, control: ZerofyApplianceControl): Promise<void> {
    // Verify user has access to this device
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      throw new Error('Access denied');
    }

    // Verify device is an appliance
    if (device.deviceType !== DeviceType.Appliance) {
      throw new Error('Device is not an appliance');
    }

    // Convert Zerofy control to internal command
    const command: ApplianceControlCommand = {
      isOn: control.isOn
    };

    // Use existing device service method
    await DeviceService.controlAppliance(deviceId, command);
  }

  /**
   * Control hot water storage boost state for Zerofy app
   */
  static async controlHotWaterStorage(deviceId: string, userId: string, control: ZerofyHotWaterControl): Promise<void> {
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      throw new Error('Access denied');
    }

    if (device.deviceType !== DeviceType.HotWaterStorage) {
      throw new Error('Device is not a hot water storage');
    }

    await DeviceService.controlHotWaterStorage(deviceId, control);
  }

  /**
   * Control EV charging for Zerofy app
   */
  static async controlEV(deviceId: string, userId: string, control: ZerofyEVControl): Promise<void> {
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      throw new Error('Access denied');
    }

    if (device.deviceType !== DeviceType.EV) {
      throw new Error('Device is not an EV');
    }

    await DeviceService.controlEV(deviceId, control);
  }

  /**
   * Control EV charger for Zerofy app
   */
  static async controlEVCharger(deviceId: string, userId: string, control: ZerofyEVChargerControl): Promise<void> {
    const device = await DeviceService.getDevice(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const dwelling = await DwellingService.getDwelling(device.dwellingId, userId);
    if (!dwelling) {
      throw new Error('Access denied');
    }

    if (device.deviceType !== DeviceType.EVCharger) {
      throw new Error('Device is not an EV charger');
    }

    await DeviceService.controlEVCharger(deviceId, control);
  }

  /**
   * Verify Zerofy JWT token
   */
  static verifyZerofyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Zerofy token verification failed');
      throw new Error('Invalid or expired Zerofy token');
    }
  }
} 