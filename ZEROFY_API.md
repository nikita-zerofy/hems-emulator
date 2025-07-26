# Zerofy API Integration Guide

The HEMS Device Emulator provides a dedicated API for the Zerofy app to integrate with emulated HEMS devices. The Zerofy app can authenticate users with their existing HEMS credentials (email/password) and then access their devices and real-time status data.

## User Flow

1. **User Setup:** User creates an account in the HEMS emulator web interface
2. **Device Configuration:** User adds dwellings and devices through the HEMS interface
3. **Zerofy Integration:** User enters their HEMS credentials in the Zerofy app
4. **Authentication:** Zerofy app authenticates with HEMS API using user credentials
5. **Device Discovery:** Zerofy app retrieves user's devices and their capabilities
6. **Real-time Monitoring:** Zerofy app monitors device status and energy data

## Base URL

```
http://localhost:3001/api/zerofy
```

## Authentication Flow

### 1. Email/Password Authentication

**Endpoint:** `POST /api/zerofy/auth`

**Description:** Authenticate using HEMS user credentials (email and password) to receive an access token.

**Request:**
```http
POST /api/zerofy/auth
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "user_password",
  "clientId": "zerofy-app"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "scope": "device:read device:status",
    "userId": "12345678-1234-1234-1234-123456789abc",
    "clientId": "zerofy-app"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

**Authentication Requirements:**
- Must use valid HEMS user credentials
- Same email/password used to access the HEMS web interface
- User must have at least one dwelling with devices to access

### 2. Using Access Tokens

Include the access token in the Authorization header for all subsequent requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Device Endpoints

### Get All Devices

**Endpoint:** `GET /api/zerofy/devices`

**Description:** Retrieve all HEMS devices accessible to the authenticated user.

**Required Scope:** `device:read`

**Request:**
```http
GET /api/zerofy/devices
Authorization: Bearer [access_token]
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "deviceId": "dev_123456789",
      "deviceType": "solar",
      "name": "Rooftop Solar Array",
      "status": "online",
      "location": {
        "dwellingId": "dwelling_987654321",
        "dwellingName": "Dwelling 98765432"
      },
      "capabilities": ["power_generation", "energy_monitoring"],
      "lastSeen": "2024-01-15T10:30:00Z"
    },
    {
      "deviceId": "dev_987654321",
      "deviceType": "battery",
      "name": "Home Battery Storage",
      "status": "online",
      "location": {
        "dwellingId": "dwelling_987654321",
        "dwellingName": "Dwelling 98765432"
      },
      "capabilities": ["energy_storage", "power_control", "soc_monitoring"],
      "lastSeen": "2024-01-15T10:29:45Z"
    }
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Get Device Details

**Endpoint:** `GET /api/zerofy/devices/{deviceId}`

**Description:** Get detailed information about a specific device.

**Required Scope:** `device:read`

**Request:**
```http
GET /api/zerofy/devices/dev_123456789
Authorization: Bearer [access_token]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deviceId": "dev_123456789",
    "deviceType": "solar",
    "name": "Rooftop Solar Array",
    "status": "online",
    "location": {
      "dwellingId": "dwelling_987654321",
      "dwellingName": "Dwelling 98765432",
      "coordinates": {
        "lat": 40.7128,
        "lng": -74.0060
      }
    },
    "capabilities": ["power_generation", "energy_monitoring"],
    "configuration": {
      "kwPeak": 5.0,
      "efficiency": 0.85,
      "azimuth": 180,
      "tilt": 30
    },
    "currentState": {
      "powerW": 3450,
      "energyTodayKwh": 18.2,
      "totalEnergyKwh": 2847.5,
      "isOnline": true
    },
    "lastUpdate": "2024-01-15T10:30:00Z",
    "metadata": {
      "manufacturer": "HEMS Emulator",
      "model": "SOLARINVERTER-SIM",
      "firmwareVersion": "1.0.0",
      "installationDate": "2024-01-10T08:00:00Z"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Get Device Status

**Endpoint:** `GET /api/zerofy/devices/{deviceId}/status`

**Description:** Get current real-time status of a specific device.

**Required Scope:** `device:status`

**Request:**
```http
GET /api/zerofy/devices/dev_123456789/status
Authorization: Bearer [access_token]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deviceId": "dev_123456789",
    "deviceType": "solar",
    "status": "online",
    "power": 3450,
    "energy": 18.2,
    "lastUpdate": "2024-01-15T10:30:00Z",
    "metadata": {
      "deviceType": "solarInverter",
      "simulated": true
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

## Device Types and Capabilities

### Device Types

| Internal Type | Zerofy Type | Description |
|---------------|-------------|-------------|
| `solarInverter` | `solar` | Solar photovoltaic inverter |
| `battery` | `battery` | Battery energy storage system |
| `appliance` | `appliance` | Smart controllable appliance |
| `meter` | `meter` | Smart electricity meter |

### Device Capabilities

| Device Type | Capabilities |
|-------------|--------------|
| `solar` | `power_generation`, `energy_monitoring` |
| `battery` | `energy_storage`, `power_control`, `soc_monitoring` |
| `appliance` | `power_control`, `energy_monitoring`, `remote_control` |
| `meter` | `power_monitoring`, `energy_monitoring`, `bidirectional_flow` |

### Device Status Values

| Field | Description | Units |
|-------|-------------|-------|
| `power` | Current power output/consumption | Watts (W) |
| `energy` | Energy generated/consumed today | Kilowatt-hours (kWh) |
| `status` | Device connectivity status | `online`, `offline`, `error` |

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_FAILED` | 401 | Email/password authentication failed |
| `UNAUTHORIZED` | 401 | Access token required or invalid |
| `INVALID_TOKEN` | 401 | Access token expired or malformed |
| `INSUFFICIENT_SCOPE` | 403 | Token lacks required permission scope |
| `DEVICE_NOT_FOUND` | 404 | Device not found or access denied |
| `DEVICES_FETCH_FAILED` | 500 | Failed to retrieve device list |
| `DEVICE_FETCH_FAILED` | 500 | Failed to retrieve device details |
| `STATUS_FETCH_FAILED` | 500 | Failed to retrieve device status |

## Rate Limiting

The API implements reasonable rate limiting:
- **Authentication:** 10 requests per minute per IP
- **Device endpoints:** 100 requests per minute per token
- **Status endpoints:** 300 requests per minute per token (for real-time updates)

## API Health Check

**Endpoint:** `GET /api/zerofy/health`

**Description:** Check API availability and status.

**Request:**
```http
GET /api/zerofy/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600.45,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

## Example Integration Flow

### 1. Authenticate and Get Access Token

```bash
curl -X POST http://localhost:3001/api/zerofy/auth \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "user_password",
    "clientId": "zerofy-app"
  }'
```

### 2. Get All Devices

```bash
curl -X GET http://localhost:3001/api/zerofy/devices \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Get Device Status

```bash
curl -X GET http://localhost:3001/api/zerofy/devices/dev_123456789/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Security Considerations

1. **Credentials:** Store user credentials securely and use secure transmission
2. **Access Tokens:** Access tokens expire after 24 hours and must be refreshed
3. **HTTPS:** Use HTTPS in production environments
4. **Scopes:** Request only the minimum required scopes
5. **Rate Limiting:** Implement client-side rate limiting to avoid hitting limits

## Support

For technical support or questions about the Zerofy API integration:
- Check the API health endpoint for system status
- Review error codes and messages for troubleshooting
- Contact the HEMS Emulator development team

---

**API Version:** 1.0.0  
**Last Updated:** January 2024 