import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { CreateConnectionSchema, UpdateConnectionSchema } from '../types';
import { broadcastMessage } from '../services/websocketService';

export const connectionsRouter = Router();

// GET /api/connections - Get all connections
connectionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const connections = await prisma.connection.findMany({
      include: {
        sourceNode: {
          select: { id: true, name: true, status: true },
        },
        targetNode: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: connections });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch connections' });
  }
});

// GET /api/connections/:id - Get single connection
connectionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const connection = await prisma.connection.findUnique({
      where: { id },
      include: {
        sourceNode: true,
        targetNode: true,
      },
    });

    if (!connection) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    res.json({ success: true, data: connection });
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch connection' });
  }
});

// POST /api/connections - Create new connection
connectionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validationResult = CreateConnectionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const { sourceNodeId, targetNodeId } = validationResult.data;

    // Prevent self-connections
    if (sourceNodeId === targetNodeId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot create a connection from a node to itself' 
      });
    }

    // Check if both nodes exist
    const [sourceNode, targetNode] = await Promise.all([
      prisma.node.findUnique({ where: { id: sourceNodeId } }),
      prisma.node.findUnique({ where: { id: targetNodeId } }),
    ]);

    if (!sourceNode || !targetNode) {
      return res.status(400).json({ 
        success: false, 
        error: 'One or both nodes do not exist' 
      });
    }

    // Check if connection already exists
    const existingConnection = await prisma.connection.findUnique({
      where: {
        sourceNodeId_targetNodeId: { sourceNodeId, targetNodeId },
      },
    });

    if (existingConnection) {
      return res.status(400).json({ 
        success: false, 
        error: 'Connection already exists between these nodes' 
      });
    }

    const connection = await prisma.connection.create({
      data: validationResult.data,
      include: {
        sourceNode: {
          select: { id: true, name: true, status: true },
        },
        targetNode: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: 'CONNECTION_CREATED',
      payload: connection,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: connection });
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ success: false, error: 'Failed to create connection' });
  }
});

// PUT /api/connections/:id - Update connection
connectionsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = UpdateConnectionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const connection = await prisma.connection.update({
      where: { id },
      data: validationResult.data,
      include: {
        sourceNode: {
          select: { id: true, name: true, status: true },
        },
        targetNode: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    res.json({ success: true, data: connection });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    console.error('Error updating connection:', error);
    res.status(500).json({ success: false, error: 'Failed to update connection' });
  }
});

// DELETE /api/connections/:id - Delete connection
connectionsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.connection.delete({
      where: { id },
    });

    // Broadcast deletion
    broadcastMessage({
      type: 'CONNECTION_DELETED',
      payload: { id },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Connection deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    console.error('Error deleting connection:', error);
    res.status(500).json({ success: false, error: 'Failed to delete connection' });
  }
});

// PATCH /api/connections/:id/set-active - Set connection as active internet source
// This will deactivate other connections to the same target node
connectionsRouter.patch('/:id/set-active', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the connection to find its target node
    const connection = await prisma.connection.findUnique({
      where: { id },
      include: {
        sourceNode: {
          select: { id: true, name: true, type: true },
        },
        targetNode: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!connection) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    // Verify the source is an INTERNET node
    if (connection.sourceNode.type !== 'INTERNET') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only connections from INTERNET nodes can be set as active source' 
      });
    }

    // Deactivate all other connections to the same target from INTERNET nodes
    await prisma.connection.updateMany({
      where: {
        targetNodeId: connection.targetNodeId,
        sourceNode: {
          type: 'INTERNET',
        },
        NOT: {
          id: id,
        },
      },
      data: {
        isActiveSource: false,
      },
    });

    // Activate this connection
    const updatedConnection = await prisma.connection.update({
      where: { id },
      data: { isActiveSource: true },
      include: {
        sourceNode: {
          select: { id: true, name: true, status: true, type: true },
        },
        targetNode: {
          select: { id: true, name: true, status: true, type: true },
        },
      },
    });

    // Broadcast the update
    broadcastMessage({
      type: 'CONNECTION_ACTIVE_SOURCE_CHANGED',
      payload: {
        connectionId: id,
        targetNodeId: connection.targetNodeId,
        isActiveSource: true,
      },
      timestamp: new Date().toISOString(),
    });

    res.json({ 
      success: true, 
      data: updatedConnection,
      message: `${connection.sourceNode.name} is now the active internet source for ${connection.targetNode.name}` 
    });
  } catch (error: any) {
    console.error('Error setting active source:', error);
    res.status(500).json({ success: false, error: 'Failed to set active source' });
  }
});

// GET /api/connections/active-sources - Get all active internet source connections
connectionsRouter.get('/internet/active-sources', async (req: Request, res: Response) => {
  try {
    const activeSources = await prisma.connection.findMany({
      where: {
        isActiveSource: true,
        sourceNode: {
          type: 'INTERNET',
        },
      },
      include: {
        sourceNode: {
          select: { id: true, name: true, status: true, internetStatus: true },
        },
        targetNode: {
          select: { id: true, name: true, status: true, type: true },
        },
      },
    });

    res.json({ success: true, data: activeSources });
  } catch (error) {
    console.error('Error fetching active sources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active sources' });
  }
});





