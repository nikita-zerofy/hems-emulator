// // import { DateTime } from 'luxon';
import {query} from '../config/database';
import {DeviceService} from './deviceService';
import {WeatherService} from './weatherService';
import {
  Device,
  DeviceType,
  WeatherData,
  SolarInverterConfig,
  SolarInverterState,
  BatteryConfig,
  BatteryState,
  ApplianceState,
  MeterState,
  SimulationUpdate,
  Dwelling
} from '../types';

export class SimulationEngine {
  private static instance: SimulationEngine;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private readonly simulationIntervalMs: number;

  private constructor(simulationIntervalMs: number = 30000) { // 30 seconds default
    this.simulationIntervalMs = simulationIntervalMs;
  }

  /**
   * Get singleton instance
   */
  static getInstance(intervalMs?: number): SimulationEngine {
    if (!SimulationEngine.instance) {
      SimulationEngine.instance = new SimulationEngine(intervalMs);
    }
    return SimulationEngine.instance;
  }

  /**
   * Start the simulation loop
   */
  start(): void {
    if (this.isRunning) {
      console.log('Simulation engine is already running');
      return;
    }

    console.log(`🚀 Starting HEMS simulation engine (interval: ${this.simulationIntervalMs}ms)`);
    this.isRunning = true;

    // Run immediately, then at intervals
    this.runSimulationCycle();

    this.intervalId = setInterval(() => {
      this.runSimulationCycle();
    }, this.simulationIntervalMs);
  }

  /**
   * Stop the simulation loop
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('⏹️ Stopping HEMS simulation engine');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Main simulation cycle - runs periodically
   */
  private async runSimulationCycle(): Promise<void> {
    try {
      console.log('🔄 Running simulation cycle...');

      // 1. Get all dwellings
      const dwellings = await this.getAllDwellings();

      if (dwellings.length === 0) {
        console.log('No dwellings found, skipping simulation cycle');
        return;
      }

      // 2. Fetch weather data for all dwelling locations
      const weatherDataMap = await WeatherService.getWeatherDataBatch(
        dwellings.map(d => ({dwellingId: d.dwellingId, location: d.location}))
      );

      // 3. Process each dwelling
      const simulationUpdates: SimulationUpdate[] = [];

      for (const dwelling of dwellings) {
        try {
          const weatherData = weatherDataMap.get(dwelling.dwellingId);
          if (!weatherData) {
            console.warn(`No weather data for dwelling ${dwelling.dwellingId}, skipping`);
            continue;
          }

          const update = await this.simulateDwelling(dwelling, weatherData);
          if (update) {
            simulationUpdates.push(update);
          }
        } catch (error) {
          console.error(`Error simulating dwelling ${dwelling.dwellingId}:`, error);
        }
      }

      console.log(`✅ Simulation cycle completed for ${simulationUpdates.length} dwellings`);

      // Broadcast updates via WebSocket
      this.broadcastUpdates(simulationUpdates);

    } catch (error) {
      console.error('Simulation cycle error:', error);
    }
  }

  /**
   * Simulate a single dwelling's energy flows
   */
  private async simulateDwelling(dwelling: Dwelling, weatherData: WeatherData): Promise<SimulationUpdate | null> {
    // Get all devices for this dwelling
    const devices = await DeviceService.getDwellingDevices(dwelling.dwellingId);

    if (devices.length === 0) {
      return null;
    }

    // Group devices by type for easier processing
    const devicesByType = this.groupDevicesByType(devices);

    // Calculate current solar generation
    const solarPowerW = this.calculateSolarGeneration(devicesByType.solarInverter, weatherData);

    // Calculate household load (appliances + phantom load)
    const householdLoadW = this.calculateHouseholdLoad(devicesByType.appliance);

    // Execute energy flow logic
    const energyFlows = this.calculateEnergyFlows(
      solarPowerW,
      householdLoadW,
      devicesByType.battery[0] // Assume single battery for now
    );

    // Update device states
    const updatedDevices = await this.updateDeviceStates(
      devicesByType,
      energyFlows,
      weatherData
    );

    return {
      dwellingId: dwelling.dwellingId,
      devices: updatedDevices,
      timestamp: new Date().toISOString(),
      weatherData
    };
  }

  /**
   * Calculate solar power generation from all solar inverters
   */
  private calculateSolarGeneration(solarInverters: Device[], weatherData: WeatherData): number {
    let totalSolarPowerW = 0;

    for (const inverter of solarInverters) {
      const config = inverter.config as SolarInverterConfig;
      const state = inverter.state as SolarInverterState;

      if (!state.isOnline) {
        continue;
      }

      const powerW = WeatherService.calculateSolarPower(
        weatherData.solarIrradianceWm2,
        config.kwPeak,
        config.efficiency,
        weatherData.temperatureC,
        weatherData.cloudCover
      );

      totalSolarPowerW += powerW;
    }

    return totalSolarPowerW;
  }

  /**
   * Calculate total household load from appliances
   */
  private calculateHouseholdLoad(appliances: Device[]): number {
    let totalLoadW = 0;

    // Sum power from all "on" appliances
    for (const appliance of appliances) {
      const state = appliance.state as ApplianceState;
      if (state.isOn && state.isOnline) {
        totalLoadW += state.powerW;
      }
    }

    // Add phantom load (baseline consumption from other household electronics)
    const phantomLoadW = 200; // 200W baseline load
    totalLoadW += phantomLoadW;

    return totalLoadW;
  }

  /**
   * Core energy flow calculation logic
   * Based on PowerEnergyFlowsCalculator principles
   */
  private calculateEnergyFlows(
    solarPowerW: number,
    householdLoadW: number,
    battery?: Device
  ): EnergyFlows {
    const flows: EnergyFlows = {
      solarToLoad: 0,
      solarToBattery: 0,
      solarToGrid: 0,
      batteryToLoad: 0,
      gridToLoad: 0,
      gridToBattery: 0,
      netGridPower: 0, // Positive = import, negative = export
      batteryPower: 0   // Positive = charging, negative = discharging
    };

    let remainingSolar = solarPowerW;
    let remainingLoad = householdLoadW;

    // 1. Solar power first goes to meet household load
    flows.solarToLoad = Math.min(remainingSolar, remainingLoad);
    remainingSolar -= flows.solarToLoad;
    remainingLoad -= flows.solarToLoad;

    // 2. Handle battery control modes and excess solar power
    if (battery) {
      const batteryConfig = battery.config as BatteryConfig;
      const batteryState = battery.state as BatteryState;
      const controlMode = batteryState.controlMode ?? 'auto';

      if (batteryState.isOnline) {
        // Handle forced charge mode
        if (controlMode === 'force_charge' && batteryState.forcePowerW) {
          const maxChargePowerW = Math.min(
            batteryState.forcePowerW,
            batteryConfig.maxChargePowerW
          );
          
          if (batteryState.batteryLevel < batteryConfig.maxSoc) {
            const availableCapacityKwh = batteryConfig.capacityKwh * (batteryConfig.maxSoc - batteryState.batteryLevel);
            const maxChargeByCapacityW = availableCapacityKwh * 1000 * 4;
            
            const actualChargePowerW = Math.min(maxChargePowerW, maxChargeByCapacityW);
            
            if (actualChargePowerW <= remainingSolar) {
              flows.solarToBattery = actualChargePowerW;
              flows.batteryPower = actualChargePowerW;
              remainingSolar -= actualChargePowerW;
            } else {
              // Need to import from grid to meet force charge target
              flows.solarToBattery = remainingSolar;
              flows.gridToBattery = actualChargePowerW - remainingSolar;
              flows.batteryPower = actualChargePowerW;
              flows.netGridPower += flows.gridToBattery;
              remainingSolar = 0;
            }
          }
        }
        // Handle forced discharge mode
        else if (controlMode === 'force_discharge' && batteryState.forcePowerW) {
          const maxDischargePowerW = Math.min(
            Math.abs(batteryState.forcePowerW),
            batteryConfig.maxDischargePowerW
          );
          
          if (batteryState.batteryLevel > batteryConfig.minSoc) {
            const availableEnergyKwh = batteryConfig.capacityKwh * (batteryState.batteryLevel - batteryConfig.minSoc);
            const maxDischargeByCapacityW = availableEnergyKwh * 1000 * 4;
            
            const actualDischargePowerW = Math.min(maxDischargePowerW, maxDischargeByCapacityW);
            
            flows.batteryPower = -actualDischargePowerW;
            // Force discharge goes to grid export (simulating battery selling to grid)
            flows.netGridPower -= actualDischargePowerW;
          }
        }
        // Handle idle mode (no battery action)
        else if (controlMode === 'idle') {
          flows.batteryPower = 0;
        }
        // Handle auto mode (normal logic)
        else if (controlMode === 'auto' && remainingSolar > 0 && batteryState.batteryLevel < batteryConfig.maxSoc) {
          const maxChargePowerW = batteryConfig.maxChargePowerW;
          const availableCapacityKwh = batteryConfig.capacityKwh * (batteryConfig.maxSoc - batteryState.batteryLevel);
          const maxChargeByCapacityW = availableCapacityKwh * 1000 * 4;

          const actualChargePowerW = Math.min(
            remainingSolar,
            maxChargePowerW,
            maxChargeByCapacityW
          );

          flows.solarToBattery = actualChargePowerW;
          flows.batteryPower = actualChargePowerW;
          remainingSolar -= actualChargePowerW;
        }
      }
    }

    // 3. Remaining solar power goes to grid (export)
    if (remainingSolar > 0) {
      flows.solarToGrid = remainingSolar;
      flows.netGridPower -= remainingSolar; // Negative for export
    }

    // 4. Handle remaining load
    if (remainingLoad > 0) {
      // Try to use battery first (only in auto mode)
      if (battery) {
        const batteryConfig = battery.config as BatteryConfig;
        const batteryState = battery.state as BatteryState;
        const controlMode = batteryState.controlMode ?? 'auto';

        if (batteryState.isOnline && 
            batteryState.batteryLevel > batteryConfig.minSoc && 
            controlMode === 'auto') {
          const maxDischargePowerW = batteryConfig.maxDischargePowerW;
          const availableEnergyKwh = batteryConfig.capacityKwh * (batteryState.batteryLevel - batteryConfig.minSoc);
          const maxDischargeByCapacityW = availableEnergyKwh * 1000 * 4;

          const actualDischargePowerW = Math.min(
            remainingLoad,
            maxDischargePowerW,
            maxDischargeByCapacityW
          );

          flows.batteryToLoad = actualDischargePowerW;
          flows.batteryPower = -actualDischargePowerW;
          remainingLoad -= actualDischargePowerW;
        }
      }

      // Remaining load comes from grid (import)
      if (remainingLoad > 0) {
        flows.gridToLoad = remainingLoad;
        flows.netGridPower += remainingLoad; // Positive for import
      }
    }

    return flows;
  }

  /**
   * Update device states based on energy flow calculations
   */
  private async updateDeviceStates(
    devicesByType: DevicesByType,
    energyFlows: EnergyFlows,
    weatherData: WeatherData
  ): Promise<Device[]> {
    const updates: Array<{ deviceId: string; state: unknown }> = [];
    // const now = DateTime.now();

    // Update solar inverters
    for (const inverter of devicesByType.solarInverter) {
      const config = inverter.config as SolarInverterConfig;
      const currentState = inverter.state as SolarInverterState;

      const powerW = WeatherService.calculateSolarPower(
        weatherData.solarIrradianceWm2,
        config.kwPeak,
        config.efficiency,
        weatherData.temperatureC,
        weatherData.cloudCover
      );

      const newState: SolarInverterState = {
        ...currentState,
        powerW: Math.round(powerW),
        energyTodayKwh: this.updateDailyEnergy(currentState.energyTodayKwh, powerW),
        totalEnergyKwh: currentState.totalEnergyKwh + (powerW / 1000 / 120) // Assuming 30-second intervals = 120 intervals per hour
      };

      updates.push({deviceId: inverter.deviceId, state: newState});
    }

    // Update battery
    if (devicesByType.battery.length > 0) {
      const battery = devicesByType.battery[0];
      const config = battery.config as BatteryConfig;
      const currentState = battery.state as BatteryState;

      // Calculate new battery level
      const energyChangeKwh = (energyFlows.batteryPower / 1000) * (this.simulationIntervalMs / 1000 / 3600);
      let newBatteryLevel = currentState.batteryLevel + (energyChangeKwh / config.capacityKwh) * config.efficiency;

      // Clamp battery level to valid range
      newBatteryLevel = Math.max(config.minSoc, Math.min(config.maxSoc, newBatteryLevel));

      const newState: BatteryState = {
        ...currentState,
        batteryLevel: Math.round(newBatteryLevel * 1000) / 1000, // Round to 3 decimal places
        powerW: Math.round(energyFlows.batteryPower),
        isCharging: energyFlows.batteryPower > 0,
        temperatureC: weatherData.temperatureC + Math.random() * 4 - 2 // Battery temp ≈ ambient ± 2°C
      };

      updates.push({deviceId: battery.deviceId, state: newState});
    }

    // Update meter
    if (devicesByType.meter.length > 0) {
      const meter = devicesByType.meter[0];
      const currentState = meter.state as MeterState;

      const newState: MeterState = {
        ...currentState,
        powerW: Math.round(energyFlows.netGridPower),
        energyImportTodayKwh: energyFlows.netGridPower > 0
          ? this.updateDailyEnergy(currentState.energyImportTodayKwh, energyFlows.netGridPower)
          : currentState.energyImportTodayKwh,
        energyExportTodayKwh: energyFlows.netGridPower < 0
          ? this.updateDailyEnergy(currentState.energyExportTodayKwh, -energyFlows.netGridPower)
          : currentState.energyExportTodayKwh,
        totalEnergyImportKwh: energyFlows.netGridPower > 0
          ? currentState.totalEnergyImportKwh + (energyFlows.netGridPower / 1000 / 120)
          : currentState.totalEnergyImportKwh,
        totalEnergyExportKwh: energyFlows.netGridPower < 0
          ? currentState.totalEnergyExportKwh + (-energyFlows.netGridPower / 1000 / 120)
          : currentState.totalEnergyExportKwh
      };

      updates.push({deviceId: meter.deviceId, state: newState});
    }

    // Update appliances (simulate some random on/off behavior for demo)
    for (const appliance of devicesByType.appliance) {
      const currentState = appliance.state as ApplianceState;

      // Random chance to change state (for demonstration)
      const shouldToggle = Math.random() < 0.05; // 5% chance per cycle
      const newIsOn = shouldToggle ? !currentState.isOn : currentState.isOn;

      const newState: ApplianceState = {
        ...currentState,
        isOn: newIsOn,
        powerW: newIsOn ? currentState.powerW : 0,
        energyTodayKwh: newIsOn
          ? this.updateDailyEnergy(currentState.energyTodayKwh, currentState.powerW)
          : currentState.energyTodayKwh
      };

      updates.push({deviceId: appliance.deviceId, state: newState});
    }

    // Batch update all device states
    await DeviceService.updateDeviceStatesBatch(updates);

    // Return updated devices
    const updatedDevices: Device[] = [];
    for (const update of updates) {
      const device = await DeviceService.getDevice(update.deviceId);
      if (device) {
        updatedDevices.push(device);
      }
    }

    return updatedDevices;
  }

  /**
   * Update daily energy counter, resetting at midnight
   */
  private updateDailyEnergy(currentDailyKwh: number, powerW: number): number {
    //const now = DateTime.now();
    const energyIncrementKwh = (powerW / 1000) * (this.simulationIntervalMs / 1000 / 3600);

    // TODO: Implement proper daily reset logic based on timezone
    // For now, just accumulate
    return currentDailyKwh + energyIncrementKwh;
  }

  /**
   * Group devices by type for easier processing
   */
  private groupDevicesByType(devices: Device[]): DevicesByType {
    const grouped: DevicesByType = {
      solarInverter: [],
      battery: [],
      appliance: [],
      meter: []
    };

    for (const device of devices) {
      switch (device.deviceType) {
        case DeviceType.SolarInverter:
          grouped.solarInverter.push(device);
          break;
        case DeviceType.Battery:
          grouped.battery.push(device);
          break;
        case DeviceType.Appliance:
          grouped.appliance.push(device);
          break;
        case DeviceType.Meter:
          grouped.meter.push(device);
          break;
      }
    }

    return grouped;
  }

  /**
   * Get all dwellings from database
   */
  private async getAllDwellings(): Promise<Dwelling[]> {
    const result = await query('SELECT dwelling_id, user_id, time_zone, location FROM dwellings');

    return result.rows.map(row => ({
      dwellingId: row.dwelling_id,
      userId: row.user_id,
      timeZone: row.time_zone,
      location: row.location
    }));
  }

  /**
   * Broadcast simulation updates via WebSocket
   */
  private broadcastUpdates(updates: SimulationUpdate[]): void {
    try {
      // Import io dynamically to avoid circular dependency
      const {io} = require('../server');

      for (const update of updates) {
        // Broadcast to dwelling-specific room
        io.to(`dwelling-${update.dwellingId}`).emit('simulation-update', update);

        // Also broadcast to general simulation room for dashboard views
        io.to('simulation').emit('dwelling-update', {
          dwellingId: update.dwellingId,
          deviceCount: update.devices.length,
          timestamp: update.timestamp,
          weatherData: update.weatherData
        });
      }

      console.log(`📡 Broadcasted updates for ${updates.length} dwellings via WebSocket`);
    } catch (error) {
      console.error('WebSocket broadcast error:', error);
    }
  }
}

// Helper types
type DevicesByType = {
  solarInverter: Device[];
  battery: Device[];
  appliance: Device[];
  meter: Device[];
};

type EnergyFlows = {
  solarToLoad: number;
  solarToBattery: number;
  solarToGrid: number;
  batteryToLoad: number;
  gridToLoad: number;
  gridToBattery: number;
  netGridPower: number;
  batteryPower: number;
}; 