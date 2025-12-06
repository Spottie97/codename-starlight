import { Router, Request, Response } from 'express';
import { prisma } from '../db';

export const probesRouter = Router();

// GET /api/probes/status - Get current status of all probes
probesRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const probes = await prisma.node.findMany({
      where: { type: 'PROBE' },
      select: {
        id: true,
        name: true,
        status: true,
        internetStatus: true,
        latency: true,
        lastSeen: true,
        internetLastCheck: true,
        mqttTopic: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: probes });
  } catch (error) {
    console.error('Error fetching probe status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch probe status' });
  }
});

// GET /api/probes/:id/history - Get status history for a probe
probesRouter.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100', from, to } = req.query;

    const where: any = { nodeId: id };

    // Add date filters if provided
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from as string);
      if (to) where.timestamp.lte = new Date(to as string);
    }

    const history = await prisma.probeStatus.findMany({
      where,
      take: parseInt(limit as string, 10),
      orderBy: { timestamp: 'desc' },
    });

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching probe history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch probe history' });
  }
});

// GET /api/probes/summary - Get summary statistics
probesRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const [totalProbes, onlineProbes, offlineProbes, degradedProbes] = await Promise.all([
      prisma.node.count({ where: { type: 'PROBE' } }),
      prisma.node.count({ where: { type: 'PROBE', status: 'ONLINE' } }),
      prisma.node.count({ where: { type: 'PROBE', status: 'OFFLINE' } }),
      prisma.node.count({ where: { type: 'PROBE', status: 'DEGRADED' } }),
    ]);

    const [internetOnline, internetOffline] = await Promise.all([
      prisma.node.count({ where: { type: 'PROBE', internetStatus: 'ONLINE' } }),
      prisma.node.count({ where: { type: 'PROBE', internetStatus: 'OFFLINE' } }),
    ]);

    res.json({
      success: true,
      data: {
        total: totalProbes,
        network: {
          online: onlineProbes,
          offline: offlineProbes,
          degraded: degradedProbes,
          unknown: totalProbes - onlineProbes - offlineProbes - degradedProbes,
        },
        internet: {
          online: internetOnline,
          offline: internetOffline,
          unknown: totalProbes - internetOnline - internetOffline,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching probe summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch probe summary' });
  }
});

// GET /api/probes/outages - Get recent outages
probesRouter.get('/outages', async (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const since = new Date();
    since.setHours(since.getHours() - parseInt(hours as string, 10));

    const outages = await prisma.probeStatus.findMany({
      where: {
        status: 'OFFLINE',
        timestamp: { gte: since },
      },
      include: {
        node: {
          select: { id: true, name: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group outages by node
    const groupedOutages = outages.reduce((acc: any, outage) => {
      const nodeId = outage.node.id;
      if (!acc[nodeId]) {
        acc[nodeId] = {
          node: outage.node,
          outages: [],
        };
      }
      acc[nodeId].outages.push({
        id: outage.id,
        timestamp: outage.timestamp,
        message: outage.message,
      });
      return acc;
    }, {});

    res.json({ 
      success: true, 
      data: Object.values(groupedOutages),
      period: `Last ${hours} hours`,
    });
  } catch (error) {
    console.error('Error fetching outages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch outages' });
  }
});





