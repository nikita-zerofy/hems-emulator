import {z} from 'zod';

// Zerofy API Authentication
export const ZerofyAuthSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  clientId: z.string().optional()
});

export type ZerofyAuth = z.infer<typeof ZerofyAuthSchema>;

// Zerofy Device Status Response
export const ZerofyDeviceStatusSchema = z.object({
  deviceId: z.string(),
  deviceType: z.enum(['solar', 'battery', 'meter', 'appliance']),
  status: z.enum(['online', 'offline', 'error']),
  power: z.number(), // Current power in watts
  energy: z.number(), // Energy today in kWh
  batteryLevel: z.number(),
  isOn: z.boolean().optional(), // On/off state for appliances
  lastUpdate: z.string().datetime(),
  metadata: z.record(z.unknown()).optional()
});

export type ZerofyDeviceStatus = z.infer<typeof ZerofyDeviceStatusSchema>;

// Zerofy Device List Response
export const ZerofyDeviceListSchema = z.object({
  deviceId: z.string(),
  deviceType: z.enum(['solar', 'battery', 'meter', 'appliance']),
  name: z.string(),
  status: z.enum(['online', 'offline', 'error']),
  location: z.object({
    dwellingId: z.string(),
    dwellingName: z.string().optional()
  }),
  capabilities: z.array(z.string()),
  lastSeen: z.string().datetime()
});

export type ZerofyDeviceList = z.infer<typeof ZerofyDeviceListSchema>;

// Zerofy Device Details Response
export const ZerofyDeviceDetailsSchema = z.object({
  deviceId: z.string(),
  deviceType: z.enum(['solar', 'battery', 'meter', 'appliance']),
  name: z.string(),
  status: z.enum(['online', 'offline', 'error']),
  location: z.object({
    dwellingId: z.string(),
    dwellingName: z.string().optional(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number()
    })
  }),
  capabilities: z.array(z.string()),
  configuration: z.record(z.unknown()),
  currentState: z.record(z.unknown()),
  lastUpdate: z.string().datetime(),
  metadata: z.object({
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    firmwareVersion: z.string().optional(),
    installationDate: z.string().datetime().optional()
  }).optional()
});

export type ZerofyDeviceDetails = z.infer<typeof ZerofyDeviceDetailsSchema>;

// Zerofy API Response wrapper
export type ZerofyApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
};

// Zerofy Authentication Response
export const ZerofyAuthResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().nullable(), // Allow null for non-expiring tokens
  scope: z.string().optional(),
  userId: z.string(),
  clientId: z.string()
});

export type ZerofyAuthResponse = z.infer<typeof ZerofyAuthResponseSchema>;

// Device type mapping from HEMS to Zerofy
export const DEVICE_TYPE_MAPPING = {
  solarInverter: 'solar',
  battery: 'battery',
  meter: 'meter',
  appliance: 'appliance'
} as const;

// Device capabilities mapping
export const DEVICE_CAPABILITIES = {
  solar: ['power_generation', 'energy_monitoring'],
  battery: ['energy_storage', 'power_control', 'soc_monitoring'],
  meter: ['power_monitoring', 'energy_monitoring', 'bidirectional_flow'],
  appliance: ['power_control', 'energy_monitoring', 'remote_control']
} as const;

// Zerofy Battery Control
export const ZerofyBatteryControlSchema = z.object({
  mode: z.enum(['auto', 'force_charge', 'force_discharge', 'idle']),
  powerW: z.number().optional()
});

export type ZerofyBatteryControl = z.infer<typeof ZerofyBatteryControlSchema>;

// Zerofy Appliance Control
export const ZerofyApplianceControlSchema = z.object({
  isOn: z.boolean()
});

export type ZerofyApplianceControl = z.infer<typeof ZerofyApplianceControlSchema>; 