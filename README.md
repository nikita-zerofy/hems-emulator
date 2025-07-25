# HEMS Device Emulator for Zerofy

A flexible and realistic Home Energy Management System (HEMS) device emulator designed to simulate diverse household setups with various combinations of solar panels, batteries, smart meters, and appliances.

## 🎯 Vision & Goals

- **Simulate diverse household setups** with various combinations of devices
- **Test the Zerofy app functionality** without requiring physical hardware  
- **Develop and debug new features** in a controlled environment
- **Create compelling product demonstrations** with realistic energy flows

## 🏗️ Architecture

The emulator consists of three core components:

- **Frontend (Control Panel)**: React-based web interface for managing simulations
- **Backend (Emulator API)**: RESTful API with real-time WebSocket support
- **Simulation Engine**: Continuous energy flow calculation service

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Docker & Docker Compose (recommended)

### Option 1: Docker Compose (Recommended)

```bash
# Clone and start the full stack
git clone <repository>
cd hems-device-emulator

# Start all services
docker-compose up --build

# The services will be available at:
# - Backend API: http://localhost:3001
# - Frontend UI: http://localhost:3000  
# - PostgreSQL: localhost:5432
```

### Option 2: Manual Setup

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your database credentials

# Set up PostgreSQL database
# Create database 'hems_emulator' and run init.sql

# Start development server
npm run dev
```

#### Frontend Setup (Coming Soon)

```bash
cd frontend
npm install
npm run dev
```

## 📡 API Documentation

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "securepassword123"
}
```

### Dwelling Management

#### Create Dwelling
```http
POST /dwellings
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "timeZone": "America/New_York",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

#### Get Dwelling Details
```http
GET /dwellings/:dwellingId
Authorization: Bearer <jwt_token>
```

### Device Management

#### Add Device to Dwelling
```http
POST /dwellings/:dwellingId/devices
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "deviceType": "solarInverter",
  "name": "Rooftop Solar Array",
  "config": {
    "kwPeak": 5.0,
    "efficiency": 0.85,
    "azimuth": 180,
    "tilt": 30
  }
}
```

#### Device Configuration Examples

**Solar Inverter:**
```json
{
  "deviceType": "solarInverter",
  "config": {
    "kwPeak": 5.0,
    "efficiency": 0.85,
    "azimuth": 180,
    "tilt": 30
  }
}
```

**Battery:**
```json
{
  "deviceType": "battery", 
  "config": {
    "capacityKwh": 13.5,
    "maxChargePowerW": 5000,
    "maxDischargePowerW": 5000,
    "efficiency": 0.95,
    "minSoc": 0.1,
    "maxSoc": 1.0
  }
}
```

**Smart Appliance:**
```json
{
  "deviceType": "appliance",
  "config": {
    "name": "Electric Vehicle Charger",
    "powerW": 7000,
    "isControllable": true
  }
}
```

**Smart Meter:**
```json
{
  "deviceType": "meter",
  "config": {
    "type": "bidirectional"
  }
}
```

## ⚡ Energy Flow Simulation

The simulation engine implements realistic energy flow logic:

1. **Solar Power Priority**: Solar generation first meets household load
2. **Battery Charging**: Excess solar charges the battery (respecting charge limits)
3. **Grid Export**: Remaining excess solar is exported to the grid
4. **Battery Discharge**: When solar is insufficient, battery supplies load (respecting discharge limits)
5. **Grid Import**: Remaining load is met by grid import

### Real-time Updates

Connect to WebSocket for live device state updates:

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3001');

// Join dwelling room for updates
socket.emit('join-dwelling', dwellingId);

// Listen for device state updates
socket.on('simulation-update', (data) => {
  console.log('Device states updated:', data);
});
```

## 🏠 Device Types & States

### Solar Inverter
- **Config**: `kwPeak`, `efficiency`, `azimuth`, `tilt`
- **State**: `powerW`, `energyTodayKwh`, `totalEnergyKwh`, `isOnline`

### Battery
- **Config**: `capacityKwh`, `maxChargePowerW`, `maxDischargePowerW`, `efficiency`, `minSoc`, `maxSoc`
- **State**: `batteryLevel`, `powerW`, `isCharging`, `isOnline`, `temperatureC`

### Smart Appliance  
- **Config**: `name`, `powerW`, `isControllable`
- **State**: `isOn`, `powerW`, `energyTodayKwh`, `isOnline`

### Smart Meter
- **Config**: `type` (import/export/bidirectional)
- **State**: `powerW`, `energyImportTodayKwh`, `energyExportTodayKwh`, `totalEnergyImportKwh`, `totalEnergyExportKwh`, `isOnline`

## 🌤️ Weather Integration

The emulator fetches real-world solar irradiance and weather data from [Open-Meteo API](https://open-meteo.com/) to calculate realistic solar generation based on:

- Solar irradiance (W/m²)
- Temperature effects on panel efficiency
- Cloud cover impact
- Time of day and seasonal variations

## 🛠️ Development

### Project Structure

```
hems-device-emulator/
├── backend/                 # Node.js/TypeScript API
│   ├── src/
│   │   ├── types/          # TypeScript type definitions
│   │   ├── config/         # Database and app configuration
│   │   ├── services/       # Business logic services
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Express middleware
│   │   └── server.ts       # Main application entry point
│   ├── database/           # Database schema and migrations
│   └── package.json
├── frontend/               # React frontend (coming soon)
├── docker-compose.yml      # Multi-service Docker setup
└── README.md
```

### Available Scripts

**Backend:**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hems_emulator

# JWT Authentication  
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000

# Simulation
SIMULATION_INTERVAL_MS=30000  # 30 seconds
```

### Simulation Parameters

The simulation engine runs on a configurable interval (default 30 seconds) and updates:

- Solar power generation based on real weather data
- Battery charging/discharging based on energy flows
- Grid import/export calculations
- Appliance power consumption
- Daily and total energy counters

## 🚀 Deployment

### Production Considerations

1. **Security**: Change default JWT secrets and database passwords
2. **Database**: Use managed PostgreSQL service (AWS RDS, etc.)
3. **Environment**: Set `NODE_ENV=production`
4. **Monitoring**: Add application monitoring and logging
5. **SSL**: Enable HTTPS in production

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 📋 Roadmap

- [x] **Phase 1**: Backend API foundation with authentication
- [x] **Phase 2**: Device management and simulation engine  
- [x] **Phase 3**: Real-time WebSocket updates
- [ ] **Phase 4**: React frontend control panel
- [ ] **Phase 5**: Advanced simulation features and analytics
- [ ] **Phase 6**: API documentation and testing improvements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For questions and support, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ for the Zerofy platform** 