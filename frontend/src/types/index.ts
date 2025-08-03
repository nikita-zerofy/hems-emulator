// API Response type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User types
export interface User {
  userId: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Location type
export interface Location {
  lat: number;
  lng: number;
}

// Dwelling type
export interface Dwelling {
  dwellingId: string;
  userId: string;
  timeZone: string;
  location: Location;
  devices?: Device[];
}

// Device types
export enum DeviceType {
  SolarInverter = 'solarInverter',
  Battery = 'battery',
  Appliance = 'appliance',
  Meter = 'meter'
}

// Device configurations
export interface SolarInverterConfig {
  kwPeak: number;
  efficiency: number;
  azimuth: number;
  tilt: number;
}

export interface BatteryConfig {
  capacityKwh: number;
  maxChargePowerW: number;
  maxDischargePowerW: number;
  efficiency: number;
  minSoc: number;
  maxSoc: number;
}

export interface ApplianceConfig {
  name: string;
  powerW: number;
  isControllable: boolean;
}

export interface MeterConfig {
  type: 'import' | 'export' | 'bidirectional';
}

// Device states
export interface SolarInverterState {
  powerW: number;
  energyTodayKwh: number;
  totalEnergyKwh: number;
  isOnline: boolean;
}

export interface BatteryState {
  batteryLevel: number; // 0-1
  powerW: number;
  isCharging: boolean;
  isOnline: boolean;
  temperatureC?: number;
}

export interface ApplianceState {
  isOn: boolean;
  powerW: number;
  energyTodayKwh: number;
  isOnline: boolean;
}

export interface MeterState {
  powerW: number;
  energyImportTodayKwh: number;
  energyExportTodayKwh: number;
  totalEnergyImportKwh: number;
  totalEnergyExportKwh: number;
  isOnline: boolean;
}

// Generic device interface
export interface Device {
  deviceId: string;
  dwellingId: string;
  deviceType: DeviceType;
  name?: string;
  config: SolarInverterConfig | BatteryConfig | ApplianceConfig | MeterConfig;
  state: SolarInverterState | BatteryState | ApplianceState | MeterState;
  createdAt: string;
  updatedAt: string;
}

// Weather data
export interface WeatherData {
  solarIrradianceWm2: number;
  temperatureC: number;
  cloudCover: number;
  timestamp: string;
}

// Simulation update
export interface SimulationUpdate {
  dwellingId: string;
  devices: Device[];
  timestamp: string;
  weatherData?: WeatherData;
}

// Form data types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface CreateDwellingForm {
  timeZone: string;
  location: Location;
}

export interface CreateDeviceForm {
  deviceType: DeviceType;
  name?: string;
  config: Record<string, unknown>;
}

export type BatteryControlMode = 'auto' | 'force_charge' | 'force_discharge' | 'idle';

export interface BatteryControlCommand {
  mode: BatteryControlMode;
  powerW?: number;
}

export interface ApplianceControlCommand {
  isOn: boolean;
}
