import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Import services and routes
import { testConnection } from './config/database';
import { SimulationEngine } from './services/simulationEngine';
import authRoutes from './routes/auth';
import dwellingRoutes from './routes/dwellings';
import deviceRoutes from './routes/devices';
import zerofyRoutes from './routes/zerofy';

// Initialize Express app
const app = express();
const port = process.env.PORT ?? 3001;

// Create HTTP server for Socket.IO
const server = createServer(app);

// Initialize Socket.IO for real-time communication
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'HEMS Device Emulator API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/dwellings', dwellingRoutes);
app.use('/', deviceRoutes); // Device routes include both /devices and /dwellings/:id/devices

// Zerofy Integration API
app.use('/api/zerofy', zerofyRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Handle client joining a dwelling room for real-time updates
  socket.on('join-dwelling', (dwellingId: string) => {
    socket.join(`dwelling-${dwellingId}`);
    console.log(`📡 Client ${socket.id} joined dwelling ${dwellingId}`);
  });

  // Handle client leaving a dwelling room
  socket.on('leave-dwelling', (dwellingId: string) => {
    socket.leave(`dwelling-${dwellingId}`);
    console.log(`📡 Client ${socket.id} left dwelling ${dwellingId}`);
  });

  // Handle client joining simulation room for general updates
  socket.on('join-simulation', () => {
    socket.join('simulation');
    console.log(`📡 Client ${socket.id} joined simulation room`);
  });

  // Handle client leaving simulation room
  socket.on('leave-simulation', () => {
    socket.leave('simulation');
    console.log(`📡 Client ${socket.id} left simulation room`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Export io for use in simulation engine
export { io };

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  
  // Stop simulation engine
  const simulationEngine = SimulationEngine.getInstance();
  simulationEngine.stop();
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    console.log('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    // Start HTTP server
    server.listen(port, () => {
      console.log(`🚀 HEMS Device Emulator API server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🔗 WebSocket endpoint: ws://localhost:${port}/socket.io/`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🐛 Development mode - detailed logging enabled`);
      }
    });

    // Start simulation engine
    const simulationEngine = SimulationEngine.getInstance();
    simulationEngine.start();
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 