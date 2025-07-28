# HEMS Device Emulator - Logging Documentation

## Overview

The HEMS Device Emulator uses **Pino** as its structured logging solution, providing comprehensive logging across all components for monitoring, debugging, and auditing purposes.

## Logger Configuration

### Development vs Production

- **Development**: Pretty-printed logs with colors and human-readable timestamps
- **Production**: Structured JSON logs optimized for log aggregation systems

### Log Levels

- `debug`: Detailed information for debugging (simulation cycles, token verification)
- `info`: General operational information (server start, user actions, API calls)
- `warn`: Warning conditions (missing data, retries)
- `error`: Error conditions (API failures, authentication errors)

### Environment Variables

- `LOG_LEVEL`: Override default log level (default: `debug` in dev, `info` in prod)
- `NODE_ENV`: Determines output format (`development` = pretty, `production` = JSON)

## Module-Specific Logging

### 🔐 Authentication Module (`auth`)

**Registration Events:**
```javascript
// User registration attempt
logger.info({ email: req.body.email }, 'User registration attempt');

// Successful registration
logger.info({ 
  userId: result.user.userId, 
  email: result.user.email 
}, 'User registered successfully');

// Registration failure
logger.error({ 
  error: error.message,
  email: req.body.email 
}, 'Registration failed');
```

**Login Events:**
```javascript
// Login attempt
logger.info({ email: req.body.email }, 'User login attempt');

// Successful login
logger.info({ 
  userId: result.user.userId, 
  email: result.user.email 
}, 'User logged in successfully');
```

### 🔌 WebSocket Module

**Connection Events:**
```javascript
// Client connection
logger.info({ socketId: socket.id }, 'WebSocket client connected');

// Room joining/leaving
logger.info({ socketId: socket.id, dwellingId }, 'Client joined dwelling room');
logger.info({ socketId: socket.id }, 'Client joined simulation room');
```

### 🏠 Simulation Engine Module (`simulation`)

**Lifecycle Events:**
```javascript
// Engine start/stop
logger.info({ intervalMs: this.simulationIntervalMs }, 'Starting HEMS simulation engine');
logger.info('Stopping HEMS simulation engine');

// Simulation cycles
logger.debug('Running simulation cycle');
logger.info({ dwellingCount: simulationUpdates.length }, 'Simulation cycle completed');
```

**Error Handling:**
```javascript
// Dwelling simulation errors
logger.error({ 
  dwellingId: dwelling.dwellingId,
  error: error.message 
}, 'Error simulating dwelling');

// Weather data issues
logger.warn({ dwellingId: dwelling.dwellingId }, 'No weather data for dwelling, skipping');
```

### 🌤️ Weather Service Module (`weather`)

**API Interactions:**
```javascript
// Weather API errors
logger.error({ 
  error: error.message,
  location 
}, 'Weather API error');

// Dwelling-specific fetch failures
logger.error({ 
  dwellingId,
  error: error.message 
}, 'Weather fetch failed for dwelling');
```

### 🔌 Zerofy API Module (`zerofy-api`)

**Authentication Events:**
```javascript
// Authentication attempts
logger.info({ 
  email: req.body.email,
  clientId: req.body.clientId 
}, 'Zerofy API authentication attempt');

// Successful authentication
logger.info({ 
  userId: authResponse.userId,
  email: req.body.email,
  clientId: req.body.clientId 
}, 'Zerofy API authentication successful');
```

**Device Operations:**
```javascript
// Device fetching
logger.info({ userId: req.zerofyUser.userId }, 'Zerofy API: Fetching user devices');
logger.info({ 
  userId: req.zerofyUser.userId,
  deviceCount: devices.length 
}, 'Zerofy API: Successfully fetched user devices');

// Battery control commands
logger.info({ 
  userId: req.zerofyUser.userId,
  deviceId,
  command: controlCommand 
}, 'Zerofy API: Battery control command received');
```

### 🔧 Zerofy Service Module (`zerofy-service`)

**Token Verification:**
```javascript
// Token verification (debug level for security)
logger.debug({ token: token.substring(0, 20) + '...' }, 'Verifying Zerofy token');
logger.debug({ userId: result.userId }, 'Zerofy token verified successfully');
```

## Request Logging Middleware

Every HTTP request is automatically logged with:

- **Request ID**: Unique identifier for request tracing
- **Method & URL**: HTTP method and endpoint
- **User Agent & IP**: Client information
- **Duration**: Request processing time
- **Status Code**: Response status

Example log entry:
```json
{
  "level": "info",
  "time": "2025-07-28T10:30:45.123Z",
  "reqId": "abc123",
  "method": "POST",
  "url": "/api/auth/login",
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.100",
  "statusCode": 200,
  "duration": "145ms",
  "msg": "Request completed",
  "module": "request",
  "service": "hems-emulator"
}
```

## Log Aggregation & Monitoring

### Production Deployment

In production, logs are structured JSON suitable for:

- **Google Cloud Logging**: Automatic ingestion and indexing
- **Elasticsearch/Kibana**: Advanced search and visualization
- **Datadog/New Relic**: APM and alerting integration

### Key Metrics to Monitor

1. **Error Rates**: Watch for spikes in error logs
2. **Authentication Failures**: Monitor failed login attempts
3. **API Response Times**: Track request duration metrics
4. **Simulation Performance**: Monitor cycle completion times
5. **Weather API Health**: Track external API failures

### Log Retention

- **Development**: Console output only
- **Production**: Recommended 30-90 days retention based on compliance needs

## Example Production Log Query

### Finding Authentication Issues
```bash
# Cloud Logging query
resource.type="cloud_run_revision" 
jsonPayload.module="auth" 
severity="ERROR"
timestamp>="2025-07-28T00:00:00Z"
```

### Monitoring API Performance
```bash
# Query for slow requests
resource.type="cloud_run_revision"
jsonPayload.duration>="1000ms"
timestamp>="2025-07-28T00:00:00Z"
```

### Tracking User Activity
```bash
# Find all actions by specific user
resource.type="cloud_run_revision"
jsonPayload.userId="user-123"
timestamp>="2025-07-28T00:00:00Z"
```

## Security Considerations

1. **Sensitive Data**: Passwords and full tokens are never logged
2. **Token Truncation**: JWT tokens are logged with only first 20 characters + "..."
3. **PII Protection**: Only necessary user identifiers (userId, email) are logged
4. **Request IDs**: Enable tracing without exposing sensitive data

## Development Tips

### Enable Debug Logging
```bash
export LOG_LEVEL=debug
npm run dev
```

### Pretty Print in Development
Logs are automatically pretty-printed in development mode with colors and readable timestamps.

### Custom Module Loggers
```typescript
import { createModuleLogger } from '../config/logger';

class MyService {
  private static logger = createModuleLogger('my-service');
  
  static doSomething() {
    this.logger.info({ param: 'value' }, 'Action performed');
  }
}
```

## Performance Impact

- **Development**: Minimal impact with pretty printing
- **Production**: Highly optimized JSON serialization
- **Log Levels**: Use appropriate levels to control verbosity
- **Structured Data**: Always use objects for contextual information

## Troubleshooting Common Issues

### High Log Volume
- Reduce log level in production (`info` or `warn`)
- Avoid logging in tight loops
- Use debug level for verbose information

### Missing Context
- Always include relevant IDs (userId, deviceId, dwellingId)
- Add request IDs for tracing across services
- Include error details with stack traces

### Log Format Issues
- Ensure `NODE_ENV` is set correctly
- Use structured objects, not string concatenation
- Validate JSON structure in production logs 