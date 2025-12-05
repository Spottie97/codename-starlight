import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { nodesRouter } from './routes/nodes';
import { connectionsRouter } from './routes/connections';
import { probesRouter } from './routes/probes';
import { networkRouter } from './routes/network';
import { initWebSocketServer } from './services/websocketService';
import { initMqttService } from './services/mqttService';
import { startMonitoringScheduler, stopMonitoringScheduler } from './services/monitoringService';

// Load environment variables
dotenv.config();

// Initialize Prisma client
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'starlight-backend'
  });
});

// API Routes
app.use('/api/nodes', nodesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/probes', probesRouter);
app.use('/api/network', networkRouter);

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
    const monitoringInterval = parseInt(process.env.MONITORING_INTERVAL || '30000', 10);
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




