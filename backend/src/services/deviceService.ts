import {v4 as uuidv4} from 'uuid';
import {query} from '../config/database';
import {
  Device,
  DeviceType,
  DeviceTypeValue,
  SolarInverterState,
  BatteryState,
  ApplianceState,
  MeterState,
  BatteryControlCommand,
  ApplianceControlCommand,
  HotWaterStorageState,
  HotWaterStorageControlCommand,
  SolarInverterConfigSchema,
  SolarInverterStateSchema,
  BatteryConfigSchema,
  BatteryStateSchema,
  ApplianceConfigSchema,
  ApplianceStateSchema,
  MeterConfigSchema,
  MeterStateSchema,
  HotWaterStorageConfigSchema,
  HotWaterStorageStateSchema,
  EVConfigSchema,
  EVStateSchema,
  EVChargerConfigSchema,
  EVChargerStateSchema,
  EVChargerControlCommand,
  EVState,
  EVChargerState
} from '../types';

export class DeviceService {
  /**
   * Create a new device for a dwelling
   */
  static async createDevice(
    dwellingId: string,
    deviceType: DeviceTypeValue,
    config: unknown,
    name?: string
  ): Promise<Device> {
    // Validate device configuration based on type
    const validatedConfig = this.validateDeviceConfig(deviceType, config);
    const initialState = this.getInitialDeviceState(deviceType);

    const deviceId = uuidv4();
    const result = await query(
      `INSERT INTO devices (device_id, dwelling_id, device_type, name, config, state)
       VALUES ($1, $2, $3, $4, $5,
               $6) RETURNING device_id, dwelling_id, device_type, name, config, state, created_at, updated_at`,
      [
        deviceId,
        dwellingId,
        deviceType,
        name ?? null,
        JSON.stringify(validatedConfig),
        JSON.stringify(initialState)
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create device');
    }

    const row = result.rows[0];
    return {
      deviceId: row.device_id,
      dwellingId: row.dwelling_id,
      deviceType: row.device_type,
      name: row.name,
      config: row.config,
      state: row.state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Get device by ID
   */
  static async getDevice(deviceId: string): Promise<Device | null> {
    const result = await query(
      `SELECT device_id,
              dwelling_id,
              device_type,
              name,
              config,
              state,
              created_at,
              updated_at
       FROM devices
       WHERE device_id = $1`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      deviceId: row.device_id,
      dwellingId: row.dwelling_id,
      deviceType: row.device_type,
      name: row.name,
      config: row.config,
      state: row.state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Get all devices for a dwelling
   */
  static async getDwellingDevices(dwellingId: string): Promise<Device[]> {
    const result = await query(
      `SELECT device_id,
              dwelling_id,
              device_type,
              name,
              config,
              state,
              created_at,
              updated_at
       FROM devices
       WHERE dwelling_id = $1
       ORDER BY created_at ASC`,
      [dwellingId]
    );

    return result.rows.map(row => ({
      deviceId: row.device_id,
      dwellingId: row.dwelling_id,
      deviceType: row.device_type,
      name: row.name,
      config: row.config,
      state: row.state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  /**
   * Update device configuration
   */
  static async updateDeviceConfig(deviceId: string, config: unknown): Promise<Device | null> {
    // Get current device to validate type
    const currentDevice = await this.getDevice(deviceId);
    if (!currentDevice) {
      return null;
    }

    // Validate new configuration
    const validatedConfig = this.validateDeviceConfig(currentDevice.deviceType, config);

    const result = await query(
      `UPDATE devices
       SET config = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $2 RETURNING device_id, dwelling_id, device_type, name, config, state, created_at, updated_at`,
      [JSON.stringify(validatedConfig), deviceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      deviceId: row.device_id,
      dwellingId: row.dwelling_id,
      deviceType: row.device_type,
      name: row.name,
      config: row.config,
      state: row.state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Update device state (used by simulation engine)
   */
  static async updateDeviceState(deviceId: string, state: unknown): Promise<Device | null> {
    // Get current device to validate type
    const currentDevice = await this.getDevice(deviceId);
    if (!currentDevice) {
      return null;
    }

    // Validate new state
    const validatedState = this.validateDeviceState(currentDevice.deviceType, state);

    const result = await query(
      `UPDATE devices
       SET state = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $2 RETURNING device_id, dwelling_id, device_type, name, config, state, created_at, updated_at`,
      [JSON.stringify(validatedState), deviceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      deviceId: row.device_id,
      dwellingId: row.dwelling_id,
      deviceType: row.device_type,
      name: row.name,
      config: row.config,
      state: row.state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Delete a device
   */
  static async deleteDevice(deviceId: string): Promise<boolean> {
    const result = await query('DELETE FROM devices WHERE device_id = $1', [deviceId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Update multiple device states (batch update for simulation)
   */
  static async updateDeviceStatesBatch(updates: Array<{ deviceId: string; state: unknown }>): Promise<void> {
    if (updates.length === 0) return;

    // Build batch update query with proper JSONB casting
    const values: unknown[] = [];
    const updateCases: string[] = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const paramIndex = i * 2 + 1;
      updateCases.push(`WHEN $${paramIndex} THEN $${paramIndex + 1}::jsonb`);
      values.push(update.deviceId, JSON.stringify(update.state));
    }

    const deviceIds = updates.map(u => u.deviceId);
    const placeholders = deviceIds.map((_, i) => `$${updates.length * 2 + 1 + i}`).join(',');
    values.push(...deviceIds);

    await query(
      `UPDATE devices
       SET state      = CASE device_id ${updateCases.join(' ')} END,
           updated_at = CURRENT_TIMESTAMP
       WHERE device_id IN (${placeholders})`,
      values
    );
  }

  /**
   * Validate device configuration based on device type
   */
  private static validateDeviceConfig(deviceType: DeviceTypeValue, config: unknown): unknown {
    switch (deviceType) {
      case DeviceType.SolarInverter:
        return SolarInverterConfigSchema.parse(config);
      case DeviceType.Battery:
        return BatteryConfigSchema.parse(config);
      case DeviceType.EV:
        return EVConfigSchema.parse(config);
      case DeviceType.Appliance:
        return ApplianceConfigSchema.parse(config);
      case DeviceType.Meter:
        return MeterConfigSchema.parse(config);
      case DeviceType.HotWaterStorage:
        return HotWaterStorageConfigSchema.parse(config);
      case DeviceType.EVCharger:
        return EVChargerConfigSchema.parse(config);
      default:
        throw new Error(`Unknown device type: ${deviceType}`);
    }
  }

  /**
   * Validate device state based on device type
   */
  private static validateDeviceState(deviceType: DeviceTypeValue, state: unknown): unknown {
    switch (deviceType) {
      case DeviceType.SolarInverter:
        return SolarInverterStateSchema.parse(state);
      case DeviceType.Battery:
        return BatteryStateSchema.parse(state);
      case DeviceType.EV:
        return EVStateSchema.parse(state);
      case DeviceType.Appliance:
        return ApplianceStateSchema.parse(state);
      case DeviceType.Meter:
        return MeterStateSchema.parse(state);
      case DeviceType.HotWaterStorage:
        return HotWaterStorageStateSchema.parse(state);
      case DeviceType.EVCharger:
        return EVChargerStateSchema.parse(state);
      default:
        throw new Error(`Unknown device type: ${deviceType}`);
    }
  }

  /**
   * Get initial state for a new device based on device type
   */
  private static getInitialDeviceState(deviceType: DeviceTypeValue): unknown {
    switch (deviceType) {
      case DeviceType.SolarInverter:
        return {
          powerW: 0,
          energyTodayKwh: 0,
          totalEnergyKwh: 0,
          isOnline: true
        } satisfies SolarInverterState;

      case DeviceType.Battery:
        return {
          batteryLevel: 0.5, // Start at 50% charge
          powerW: 0,
          isCharging: false,
          isOnline: true,
          controlMode: "auto" // Default mode, adjust if needed
        } satisfies BatteryState;

      case DeviceType.EV:
        return {
          batteryLevel: 0.5,
          isPluggedIn: true,
          isCharging: true,
          powerW: 0,
          energyTodayKwh: 0,
          isOnline: true
        } satisfies EVState;

      case DeviceType.Appliance:
        return {
          isOn: false,
          powerW: 0,
          energyTodayKwh: 0,
          isOnline: true
        } satisfies ApplianceState;

      case DeviceType.Meter:
        return {
          powerW: 0,
          energyImportTodayKwh: 0,
          energyExportTodayKwh: 0,
          totalEnergyImportKwh: 0,
          totalEnergyExportKwh: 0,
          isOnline: true
        } satisfies MeterState;
      case DeviceType.HotWaterStorage:
        return {
          power: 0,
          waterTemperatureC: 40,
          targetTemperatureC: 50,
          isHotWaterBoostOn: false,
          isOnline: true
        } satisfies HotWaterStorageState;

      case DeviceType.EVCharger:
        return {
          isCharging: false,
          powerW: 0,
          targetPowerW: undefined,
          energyTodayKwh: 0,
          isOnline: true
        } satisfies EVChargerState;

      default:
        throw new Error(`Unknown device type: ${deviceType}`);
    }
  }

  /**
   * Control battery charge/discharge mode
   */
  static async controlBattery(deviceId: string, command: BatteryControlCommand): Promise<void> {
    // Validate device exists and is a battery
    const deviceResult = await query(
      'SELECT device_id, device_type, state FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      throw new Error('Device not found');
    }

    const device = deviceResult.rows[0];
    if (device.device_type !== 'battery') {
      throw new Error('Device is not a battery');
    }

    // Parse current state and update control mode
    const currentState = BatteryStateSchema.parse(device.state);
    const updatedState: BatteryState = {
      ...currentState,
      controlMode: command.mode,
      forcePowerW: command.powerW
    };

    // Update database
    await query(
      'UPDATE devices SET state = $1, updated_at = CURRENT_TIMESTAMP WHERE device_id = $2',
      [JSON.stringify(updatedState), deviceId]
    );
  }

  /**
   * Control appliance on/off state
   */
  static async controlAppliance(deviceId: string, command: ApplianceControlCommand): Promise<void> {
    // Validate device exists and is an appliance
    const deviceResult = await query(
      'SELECT device_id, device_type, state, config FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      throw new Error('Device not found');
    }

    const device = deviceResult.rows[0];
    if (device.device_type !== 'appliance') {
      throw new Error('Device is not an appliance');
    }

    // Parse current state and config
    const currentState = ApplianceStateSchema.parse(device.state);
    const config = ApplianceConfigSchema.parse(device.config);

    // Check if appliance is controllable
    if (!config.isControllable) {
      throw new Error('Appliance is not controllable');
    }

    // Update appliance state
    const updatedState: ApplianceState = {
      ...currentState,
      isOn: command.isOn,
      // Update power based on on/off state
      powerW: command.isOn ? config.powerW : 0
    };

    // Update database
    await query(
      'UPDATE devices SET state = $1, updated_at = CURRENT_TIMESTAMP WHERE device_id = $2',
      [JSON.stringify(updatedState), deviceId]
    );
  }

  /**
   * Control hot water storage boost state and target temperature
   */
  static async controlHotWaterStorage(deviceId: string, command: HotWaterStorageControlCommand): Promise<void> {
    const deviceResult = await query(
      'SELECT device_id, device_type, state, config FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      throw new Error('Device not found');
    }

    const device = deviceResult.rows[0];
    if (device.device_type !== DeviceType.HotWaterStorage) {
      throw new Error('Device is not a hot water storage');
    }

    const currentState = HotWaterStorageStateSchema.parse(device.state);
    const config = HotWaterStorageConfigSchema.parse(device.config);

    const newTarget = command.targetTemperatureC ?? currentState.targetTemperatureC ?? config.maxTemperatureC;
    const clampedTarget = Math.min(config.maxTemperatureC, Math.max(config.minTemperatureC, newTarget));

    const updatedState: HotWaterStorageState = {
      ...currentState,
      isHotWaterBoostOn: command.boostOn,
      targetTemperatureC: clampedTarget
    };

    await query(
      'UPDATE devices SET state = $1, updated_at = CURRENT_TIMESTAMP WHERE device_id = $2',
      [JSON.stringify(updatedState), deviceId]
    );
  }

  /**
   * Control EV charger start/stop and target power
   */
  static async controlEVCharger(deviceId: string, command: EVChargerControlCommand): Promise<void> {
    const deviceResult = await query(
      'SELECT device_id, device_type, state, config FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      throw new Error('Device not found');
    }

    const device = deviceResult.rows[0];
    if (device.device_type !== DeviceType.EVCharger) {
      throw new Error('Device is not an EV charger');
    }

    const currentState = EVChargerStateSchema.parse(device.state);
    const config = EVChargerConfigSchema.parse(device.config);

    const desiredPower = command.targetPowerW ?? currentState.targetPowerW ?? config.maxPowerW;
    const clampedPower = Math.max(config.minPowerW, Math.min(config.maxPowerW, desiredPower));

    const updatedState: EVChargerState = {
      ...currentState,
      isCharging: command.isCharging,
      targetPowerW: clampedPower,
      powerW: command.isCharging ? clampedPower : 0
    };

    await query(
      'UPDATE devices SET state = $1, updated_at = CURRENT_TIMESTAMP WHERE device_id = $2',
      [JSON.stringify(updatedState), deviceId]
    );
  }
} 