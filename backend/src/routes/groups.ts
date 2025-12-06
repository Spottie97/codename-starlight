import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { CreateGroupSchema, UpdateGroupSchema } from '../types';
import { broadcastMessage } from '../services/websocketService';

export const groupsRouter = Router();

// GET /api/groups - Get all groups
groupsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const groups = await prisma.nodeGroup.findMany({
      orderBy: { zIndex: 'asc' },
      include: {
        nodes: {
          select: { id: true },
        },
      },
    });
    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/:id - Get single group with its nodes
groupsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await prisma.nodeGroup.findUnique({
      where: { id },
      include: {
        nodes: true,
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    res.json({ success: true, data: group });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch group' });
  }
});

// POST /api/groups - Create new group
groupsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validationResult = CreateGroupSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const group = await prisma.nodeGroup.create({
      data: validationResult.data,
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: 'GROUP_CREATED',
      payload: group,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
});

// PUT /api/groups/:id - Update group
groupsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = UpdateGroupSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const group = await prisma.nodeGroup.update({
      where: { id },
      data: validationResult.data,
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: 'GROUP_UPDATED',
      payload: group,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: group });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    console.error('Error updating group:', error);
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
});

// PATCH /api/groups/:id/position - Update group position and size (for drag/resize)
groupsRouter.patch('/:id/position', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { positionX, positionY, width, height } = req.body;

    const updateData: any = {};
    if (typeof positionX === 'number') updateData.positionX = positionX;
    if (typeof positionY === 'number') updateData.positionY = positionY;
    if (typeof width === 'number') updateData.width = width;
    if (typeof height === 'number') updateData.height = height;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one of positionX, positionY, width, or height must be provided' 
      });
    }

    const group = await prisma.nodeGroup.update({
      where: { id },
      data: updateData,
    });

    // Broadcast position/size update
    broadcastMessage({
      type: 'GROUP_UPDATED',
      payload: { id, ...updateData },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: group });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    console.error('Error updating group position:', error);
    res.status(500).json({ success: false, error: 'Failed to update group position' });
  }
});

// POST /api/groups/:id/assign-node - Assign a node to a group
groupsRouter.post('/:id/assign-node', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nodeId } = req.body;

    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId is required' });
    }

    // Verify group exists
    const group = await prisma.nodeGroup.findUnique({ where: { id } });
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    // Update node's groupId
    const node = await prisma.node.update({
      where: { id: nodeId },
      data: { groupId: id },
    });

    // Broadcast node group change
    broadcastMessage({
      type: 'NODE_GROUP_CHANGED',
      payload: { nodeId, groupId: id },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: node });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    console.error('Error assigning node to group:', error);
    res.status(500).json({ success: false, error: 'Failed to assign node to group' });
  }
});

// POST /api/groups/:id/unassign-node - Remove a node from a group
groupsRouter.post('/:id/unassign-node', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nodeId } = req.body;

    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId is required' });
    }

    // Update node's groupId to null
    const node = await prisma.node.update({
      where: { id: nodeId },
      data: { groupId: null },
    });

    // Broadcast node group change
    broadcastMessage({
      type: 'NODE_GROUP_CHANGED',
      payload: { nodeId, groupId: null },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: node });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }
    console.error('Error unassigning node from group:', error);
    res.status(500).json({ success: false, error: 'Failed to unassign node from group' });
  }
});

// DELETE /api/groups/:id - Delete group (nodes remain, just unassigned)
groupsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First, unassign all nodes from this group
    await prisma.node.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    // Delete the group
    await prisma.nodeGroup.delete({
      where: { id },
    });

    // Broadcast deletion
    broadcastMessage({
      type: 'GROUP_DELETED',
      payload: { id },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    console.error('Error deleting group:', error);
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});


