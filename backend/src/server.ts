import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';

import { prisma } from './db';
import { nodesRouter } from './routes/nodes';
import { connectionsRouter } from './routes/connections';
import { probesRouter } from './routes/probes';
import { networkRouter } from './routes/network';
import { groupsRouter } from './routes/groups';
import { groupConnectionsRouter } from './routes/groupConnections';
import { authRouter } from './routes/auth';
import { webhooksRouter } from './routes/webhooks';
import { setupRouter } from './routes/setup';
import { settingsRouter } from './routes/settings';
import { authMiddleware } from './middleware/auth';
import { initWebSocketServer } from './services/websocketService';
import { initMqttService } from './services/mqttService';
import { startMonitoringScheduler, stopMonitoringScheduler } from './services/monitoringService';
import { getPerformanceConfig } from './services/settingsService';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'starlight-backend'
  });
});

// Public routes (no auth required)
app.use('/api/auth', authRouter);
app.use('/api/setup', setupRouter);

// Apply auth middleware to all protected routes
app.use('/api', authMiddleware);

// Protected API Routes
app.use('/api/nodes', nodesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/probes', probesRouter);
app.use('/api/network', networkRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/group-connections', groupConnectionsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/settings', settingsRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Connected to database');

    // Initialize WebSocket server
    initWebSocketServer(httpServer);
    console.log('✅ WebSocket server initialized');

    // Initialize MQTT service
    await initMqttService();
    console.log('✅ MQTT service initialized');

    // Start monitoring scheduler for active monitoring (ping/snmp/http)
    // Get interval from database settings (with fallback to env var for backwards compatibility)
    let monitoringInterval: number;
    try {
      const perfConfig = await getPerformanceConfig();
      monitoringInterval = perfConfig.monitoringIntervalMs;
      console.log(`📊 Using monitoring interval from settings: ${monitoringInterval / 1000}s`);
    } catch {
      // Fallback to environment variable if settings not available
      monitoringInterval = parseInt(process.env.MONITORING_INTERVAL || '60000', 10);
      console.log(`📊 Using monitoring interval from env: ${monitoringInterval / 1000}s`);
    }
    startMonitoringScheduler(monitoringInterval);
    console.log('✅ Monitoring scheduler started');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🌟 Starlight Network Monitor Backend            ║
║                                                   ║
║   Server running on port ${PORT}                    ║
║   Health check: http://localhost:${PORT}/health     ║
║   API base: http://localhost:${PORT}/api            ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopMonitoringScheduler();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  stopMonitoringScheduler();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();




