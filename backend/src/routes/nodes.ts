import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { CreateNodeSchema, UpdateNodeSchema } from '../types';
import { broadcastMessage } from '../services/websocketService';

export const nodesRouter = Router();

// GET /api/nodes - Get all nodes
nodesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const nodes = await prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: nodes });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nodes' });
  }
});

// GET /api/nodes/:id - Get single node
nodesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const node = await prisma.node.findUnique({
      where: { id },
      include: {
        outgoingConnections: true,
        incomingConnections: true,
        statusHistory: {
          take: 100,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    res.json({ success: true, data: node });
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch node' });
  }
});

// POST /api/nodes - Create new node
nodesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validationResult = CreateNodeSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const node = await prisma.node.create({
      data: validationResult.data,
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: 'NODE_CREATED',
      payload: node,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: node });
  } catch (error) {
    console.error('Error creating node:', error);
    res.status(500).json({ success: false, error: 'Failed to create node' });
  }
});

// PUT /api/nodes/:id - Update node
nodesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = UpdateNodeSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const node = await prisma.node.update({
      where: { id },
      data: validationResult.data,
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: 'NODE_UPDATED',
      payload: node,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: node });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    console.error('Error updating node:', error);
    res.status(500).json({ success: false, error: 'Failed to update node' });
  }
});

// PATCH /api/nodes/:id/position - Update node position (for drag and drop)
nodesRouter.patch('/:id/position', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { positionX, positionY } = req.body;

    if (typeof positionX !== 'number' || typeof positionY !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'positionX and positionY must be numbers' 
      });
    }

    const node = await prisma.node.update({
      where: { id },
      data: { positionX, positionY },
    });

    // Broadcast position update
    broadcastMessage({
      type: 'NODE_UPDATED',
      payload: { id, positionX, positionY },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: node });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    console.error('Error updating node position:', error);
    res.status(500).json({ success: false, error: 'Failed to update node position' });
  }
});

// DELETE /api/nodes/:id - Delete node
nodesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.node.delete({
      where: { id },
    });

    // Broadcast deletion
    broadcastMessage({
      type: 'NODE_DELETED',
      payload: { id },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Node deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    console.error('Error deleting node:', error);
    res.status(500).json({ success: false, error: 'Failed to delete node' });
  }
});

