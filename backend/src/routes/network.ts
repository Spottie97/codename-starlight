import { Router, Request, Response } from 'express';
import { prisma } from '../server';

export const networkRouter = Router();

// GET /api/network - Get full network topology
networkRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [nodes, connections] = await Promise.all([
      prisma.node.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.connection.findMany({
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        nodes,
        connections,
      },
    });
  } catch (error) {
    console.error('Error fetching network topology:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch network topology' });
  }
});

// GET /api/network/layouts - Get saved network layouts
networkRouter.get('/layouts', async (req: Request, res: Response) => {
  try {
    const layouts = await prisma.networkLayout.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: layouts });
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch layouts' });
  }
});

// GET /api/network/layouts/:id - Get a specific layout
networkRouter.get('/layouts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const layout = await prisma.networkLayout.findUnique({
      where: { id },
    });

    if (!layout) {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }

    res.json({ success: true, data: layout });
  } catch (error) {
    console.error('Error fetching layout:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch layout' });
  }
});

// POST /api/network/layouts - Save current network as a layout
networkRouter.post('/layouts', async (req: Request, res: Response) => {
  try {
    const { name, description, isDefault } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Get current network topology
    const [nodes, connections] = await Promise.all([
      prisma.node.findMany(),
      prisma.connection.findMany(),
    ]);

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.networkLayout.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const layout = await prisma.networkLayout.create({
      data: {
        name,
        description,
        isDefault: isDefault || false,
        layoutData: { nodes, connections },
      },
    });

    res.status(201).json({ success: true, data: layout });
  } catch (error) {
    console.error('Error saving layout:', error);
    res.status(500).json({ success: false, error: 'Failed to save layout' });
  }
});

// POST /api/network/layouts/:id/load - Load a saved layout
networkRouter.post('/layouts/:id/load', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const layout = await prisma.networkLayout.findUnique({
      where: { id },
    });

    if (!layout) {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }

    const layoutData = layout.layoutData as { nodes: any[]; connections: any[] };

    // Clear existing network
    await prisma.connection.deleteMany();
    await prisma.node.deleteMany();

    // Recreate nodes and connections
    for (const node of layoutData.nodes) {
      await prisma.node.create({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          description: node.description,
          positionX: node.positionX,
          positionY: node.positionY,
          mqttTopic: node.mqttTopic,
          color: node.color,
          icon: node.icon,
          status: 'UNKNOWN',
          internetStatus: 'UNKNOWN',
        },
      });
    }

    for (const connection of layoutData.connections) {
      await prisma.connection.create({
        data: {
          id: connection.id,
          sourceNodeId: connection.sourceNodeId,
          targetNodeId: connection.targetNodeId,
          label: connection.label,
          bandwidth: connection.bandwidth,
          color: connection.color,
          animated: connection.animated,
        },
      });
    }

    res.json({ 
      success: true, 
      message: 'Layout loaded successfully',
      data: { nodes: layoutData.nodes.length, connections: layoutData.connections.length },
    });
  } catch (error) {
    console.error('Error loading layout:', error);
    res.status(500).json({ success: false, error: 'Failed to load layout' });
  }
});

// DELETE /api/network/layouts/:id - Delete a saved layout
networkRouter.delete('/layouts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.networkLayout.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Layout deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }
    console.error('Error deleting layout:', error);
    res.status(500).json({ success: false, error: 'Failed to delete layout' });
  }
});



