import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { CreateGroupConnectionSchema, UpdateGroupConnectionSchema } from '../types';
import { broadcastMessage } from '../services/websocketService';

export const groupConnectionsRouter = Router();

// GET /api/group-connections - Get all group connections
groupConnectionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const groupConnections = await prisma.groupConnection.findMany({
      include: {
        sourceGroup: {
          select: { id: true, name: true, color: true },
        },
        targetGroup: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: groupConnections });
  } catch (error) {
    console.error('Error fetching group connections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch group connections' });
  }
});

// GET /api/group-connections/:id - Get single group connection
groupConnectionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const groupConnection = await prisma.groupConnection.findUnique({
      where: { id },
      include: {
        sourceGroup: true,
        targetGroup: true,
      },
    });

    if (!groupConnection) {
      return res.status(404).json({ success: false, error: 'Group connection not found' });
    }

    res.json({ success: true, data: groupConnection });
  } catch (error) {
    console.error('Error fetching group connection:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch group connection' });
  }
});

// POST /api/group-connections - Create new group connection
groupConnectionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validationResult = CreateGroupConnectionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const { sourceGroupId, targetGroupId } = validationResult.data;

    // Prevent self-connections
    if (sourceGroupId === targetGroupId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot create a connection from a group to itself' 
      });
    }

    // Check if both groups exist
    const [sourceGroup, targetGroup] = await Promise.all([
      prisma.nodeGroup.findUnique({ where: { id: sourceGroupId } }),
      prisma.nodeGroup.findUnique({ where: { id: targetGroupId } }),
    ]);

    if (!sourceGroup || !targetGroup) {
      return res.status(400).json({ 
        success: false, 
        error: 'One or both groups do not exist' 
      });
    }

    // Check if connection already exists (in either direction)
    const existingConnection = await prisma.groupConnection.findFirst({
      where: {
        OR: [
          { sourceGroupId, targetGroupId },
          { sourceGroupId: targetGroupId, targetGroupId: sourceGroupId },
        ],
      },
    });

    if (existingConnection) {
      return res.status(400).json({ 
        success: false, 
        error: 'Connection already exists between these groups' 
      });
    }

    const groupConnection = await prisma.groupConnection.create({
      data: validationResult.data,
      include: {
        sourceGroup: {
          select: { id: true, name: true, color: true },
        },
        targetGroup: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: 'GROUP_CONNECTION_CREATED',
      payload: groupConnection,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: groupConnection });
  } catch (error) {
    console.error('Error creating group connection:', error);
    res.status(500).json({ success: false, error: 'Failed to create group connection' });
  }
});

// PUT /api/group-connections/:id - Update group connection
groupConnectionsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = UpdateGroupConnectionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const groupConnection = await prisma.groupConnection.update({
      where: { id },
      data: validationResult.data,
      include: {
        sourceGroup: {
          select: { id: true, name: true, color: true },
        },
        targetGroup: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    res.json({ success: true, data: groupConnection });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Group connection not found' });
    }
    console.error('Error updating group connection:', error);
    res.status(500).json({ success: false, error: 'Failed to update group connection' });
  }
});

// DELETE /api/group-connections/:id - Delete group connection
groupConnectionsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.groupConnection.delete({
      where: { id },
    });

    // Broadcast deletion
    broadcastMessage({
      type: 'GROUP_CONNECTION_DELETED',
      payload: { id },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Group connection deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Group connection not found' });
    }
    console.error('Error deleting group connection:', error);
    res.status(500).json({ success: false, error: 'Failed to delete group connection' });
  }
});


