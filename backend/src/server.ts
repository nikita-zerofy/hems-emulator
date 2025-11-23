import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import {Server} from 'socket.io';
import {createServer} from 'http';
import {logger} from './config/logger';
import pinoHttp from 'pino-http';

// Load environment variables
dotenv.config();

// Import services and routes
import {testConnection} from './config/database';
import {SimulationEngine} from './services/simulationEngine';
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

app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true}));

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

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
  logger.info({socketId: socket.id}, 'WebSocket client connected');

  // Handle client joining a dwelling room for real-time updates
  socket.on('join-dwelling', (dwellingId: string) => {
    socket.join(`dwelling-${dwellingId}`);
    logger.info({socketId: socket.id, dwellingId}, 'Client joined dwelling room');
  });

  // Handle client leaving a dwelling room
  socket.on('leave-dwelling', (dwellingId: string) => {
    socket.leave(`dwelling-${dwellingId}`);
    logger.info({socketId: socket.id, dwellingId}, 'Client left dwelling room');
  });

  // Handle client joining simulation room for general updates
  socket.on('join-simulation', () => {
    socket.join('simulation');
    logger.info({socketId: socket.id}, 'Client joined simulation room');
  });

  // Handle client leaving simulation room
  socket.on('leave-simulation', () => {
    socket.leave('simulation');
    logger.info({socketId: socket.id}, 'Client left simulation room');
  });

  socket.on('disconnect', () => {
    logger.info({socketId: socket.id}, 'WebSocket client disconnected');
  });
});

// Export io for use in simulation engine
export {io};

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
  logger.info({signal}, 'Received shutdown signal, shutting down gracefully');

  // Stop simulation engine
  const simulationEngine = SimulationEngine.getInstance();
  simulationEngine.stop();

  // Close server
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force close after timeout
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
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
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    // Start HTTP server
    server.listen(port, () => {
      logger.info({port}, 'HEMS Device Emulator API server started');
      logger.info({url: `http://localhost:${port}/health`}, 'Health check endpoint ready');
      logger.info({url: `ws://localhost:${port}/socket.io/`}, 'WebSocket endpoint ready');

      if (process.env.NODE_ENV === 'development') {
        logger.debug('Development mode - detailed logging enabled');
      }
    });

    // Start simulation engine
    const simulationEngine = SimulationEngine.getInstance();
    simulationEngine.start();

  } catch (error) {
    logger.error({error}, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer(); 