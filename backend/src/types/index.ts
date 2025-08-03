import {z} from 'zod';

// Device types enum
export const DeviceType = {
  SolarInverter: 'solarInverter',
  Meter: 'meter',
  Battery: 'battery',
  Appliance: 'appliance'
} as const;

export type DeviceTypeValue = typeof DeviceType[keyof typeof DeviceType];

// Location coordinates
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export type Location = z.infer<typeof LocationSchema>;

// User model
export const UserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8)
});

export type User = z.infer<typeof UserSchema>;

export type UserWithoutPassword = Omit<User, 'password'>;

// Dwelling model
export const DwellingSchema = z.object({
  dwellingId: z.string().uuid(),
  userId: z.string().uuid(),
  timeZone: z.string(),
  location: LocationSchema
});

export type Dwelling = z.infer<typeof DwellingSchema>;

// Device configuration schemas for each device type
export const SolarInverterConfigSchema = z.object({
  kwPeak: z.number().positive(),
  efficiency: z.number().min(0).max(1).default(0.85),
  azimuth: z.number().min(0).max(360).default(180), // South-facing
  tilt: z.number().min(0).max(90).default(30)
});

export const BatteryConfigSchema = z.object({
  capacityKwh: z.number().positive(),
  maxChargePowerW: z.number().positive(),
  maxDischargePowerW: z.number().positive(),
  efficiency: z.number().min(0).max(1).default(0.95),
  minSoc: z.number().min(0).max(1).default(0.1), // Minimum state of charge
  maxSoc: z.number().min(0).max(1).default(1.0)   // Maximum state of charge
});

export const ApplianceConfigSchema = z.object({
  name: z.string(),
  powerW: z.number().positive(),
  isControllable: z.boolean().default(false)
});

export const MeterConfigSchema = z.object({
  type: z.enum(['import', 'export', 'bidirectional']).default('bidirectional')
});

// Device state schemas
export const SolarInverterStateSchema = z.object({
  powerW: z.number().min(0),
  energyTodayKwh: z.number().min(0),
  totalEnergyKwh: z.number().min(0),
  isOnline: z.boolean()
});

export const BatteryControlModeSchema = z.enum(['auto', 'force_charge', 'force_discharge', 'idle']);
export type BatteryControlMode = z.infer<typeof BatteryControlModeSchema>;

export const BatteryStateSchema = z.object({
  batteryLevel: z.number().min(0).max(1), // State of charge (0-1)
  powerW: z.number(), // Positive for charging, negative for discharging
  isCharging: z.boolean(),
  isOnline: z.boolean(),
  temperatureC: z.number().optional(),
  controlMode: BatteryControlModeSchema.default('auto'),
  forcePowerW: z.number().optional() // Power target when in force mode
});

export const ApplianceStateSchema = z.object({
  isOn: z.boolean(),
  powerW: z.number().min(0),
  energyTodayKwh: z.number().min(0),
  isOnline: z.boolean()
});

export const MeterStateSchema = z.object({
  powerW: z.number(), // Positive for import, negative for export
  energyImportTodayKwh: z.number().min(0),
  energyExportTodayKwh: z.number().min(0),
  totalEnergyImportKwh: z.number().min(0),
  totalEnergyExportKwh: z.number().min(0),
  isOnline: z.boolean()
});

// Generic device schema
export const DeviceSchema = z.object({
  deviceId: z.string().uuid(),
  dwellingId: z.string().uuid(),
  deviceType: z.nativeEnum(DeviceType),
  config: z.unknown(), // Will be validated based on deviceType
  state: z.unknown(),  // Will be validated based on deviceType
  name: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Device = z.infer<typeof DeviceSchema>;

// Typed device interfaces
export type SolarInverterConfig = z.infer<typeof SolarInverterConfigSchema>;
export type BatteryConfig = z.infer<typeof BatteryConfigSchema>;
export type ApplianceConfig = z.infer<typeof ApplianceConfigSchema>;
export type MeterConfig = z.infer<typeof MeterConfigSchema>;

export type SolarInverterState = z.infer<typeof SolarInverterStateSchema>;
export type BatteryState = z.infer<typeof BatteryStateSchema>;

export const BatteryControlCommandSchema = z.object({
  mode: BatteryControlModeSchema,
  powerW: z.number().optional() // Required for force_charge/force_discharge
});

export type BatteryControlCommand = z.infer<typeof BatteryControlCommandSchema>;

// Appliance control
export const ApplianceControlCommandSchema = z.object({
  isOn: z.boolean()
});
export type ApplianceControlCommand = z.infer<typeof ApplianceControlCommandSchema>;

export type ApplianceState = z.infer<typeof ApplianceStateSchema>;
export type MeterState = z.infer<typeof MeterStateSchema>;

// Weather data from external API
export const WeatherDataSchema = z.object({
  solarIrradianceWm2: z.number().min(0),
  temperatureC: z.number(),
  cloudCover: z.number().min(0).max(100),
  timestamp: z.string().datetime()
});

export type WeatherData = z.infer<typeof WeatherDataSchema>;

// Simulation update event
export const SimulationUpdateSchema = z.object({
  dwellingId: z.string().uuid(),
  devices: z.array(DeviceSchema),
  timestamp: z.string().datetime(),
  weatherData: WeatherDataSchema.optional()
});

export type SimulationUpdate = z.infer<typeof SimulationUpdateSchema>;

// API Response types
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// JWT Payload
export type JwtPayload = {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}; 