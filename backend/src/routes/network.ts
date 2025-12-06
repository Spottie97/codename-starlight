import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { getCurrentIsp, detectAndSwitchIsp, forceRefreshIsp } from '../services/ispService';

export const networkRouter = Router();

// GET /api/network - Get full network topology
networkRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [nodes, connections, groups, groupConnections] = await Promise.all([
      prisma.node.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.connection.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.nodeGroup.findMany({
        orderBy: { zIndex: 'asc' },
      }),
      prisma.groupConnection.findMany({
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        nodes,
        connections,
        groups,
        groupConnections,
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
    const [nodes, connections, groups, groupConnections] = await Promise.all([
      prisma.node.findMany(),
      prisma.connection.findMany(),
      prisma.nodeGroup.findMany(),
      prisma.groupConnection.findMany(),
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
        layoutData: { nodes, connections, groups, groupConnections },
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

    const layoutData = layout.layoutData as { nodes: any[]; connections: any[]; groups?: any[]; groupConnections?: any[] };

    // Clear existing network
    await prisma.groupConnection.deleteMany();
    await prisma.connection.deleteMany();
    await prisma.node.deleteMany();
    await prisma.nodeGroup.deleteMany();

    // Recreate groups first (so nodes can reference them)
    if (layoutData.groups) {
      for (const group of layoutData.groups) {
        await prisma.nodeGroup.create({
          data: {
            id: group.id,
            name: group.name,
            description: group.description,
            positionX: group.positionX,
            positionY: group.positionY,
            width: group.width,
            height: group.height,
            color: group.color,
            opacity: group.opacity,
            zIndex: group.zIndex,
          },
        });
      }
    }

    // Recreate nodes
    for (const node of layoutData.nodes) {
      await prisma.node.create({
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          description: node.description,
          positionX: node.positionX,
          positionY: node.positionY,
          groupId: node.groupId,
          mqttTopic: node.mqttTopic,
          color: node.color,
          icon: node.icon,
          status: 'UNKNOWN',
          internetStatus: 'UNKNOWN',
        },
      });
    }

    // Recreate connections
    for (const connection of layoutData.connections) {
      await prisma.connection.create({
        data: {
          id: connection.id,
          sourceNodeId: connection.sourceNodeId,
          targetNodeId: connection.targetNodeId,
          label: connection.label,
          bandwidth: connection.bandwidth,
          isActiveSource: connection.isActiveSource || false,
          color: connection.color,
          animated: connection.animated,
        },
      });
    }

    // Recreate group connections
    if (layoutData.groupConnections) {
      for (const groupConnection of layoutData.groupConnections) {
        await prisma.groupConnection.create({
          data: {
            id: groupConnection.id,
            sourceGroupId: groupConnection.sourceGroupId,
            targetGroupId: groupConnection.targetGroupId,
            label: groupConnection.label,
            bandwidth: groupConnection.bandwidth,
            color: groupConnection.color,
            animated: groupConnection.animated,
          },
        });
      }
    }

    res.json({ 
      success: true, 
      message: 'Layout loaded successfully',
      data: { 
        nodes: layoutData.nodes.length, 
        connections: layoutData.connections.length,
        groups: layoutData.groups?.length || 0,
        groupConnections: layoutData.groupConnections?.length || 0,
      },
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

// ============================================
// ISP Detection Endpoints
// ============================================

// GET /api/network/isp - Get current ISP information
networkRouter.get('/isp', async (req: Request, res: Response) => {
  try {
    const ispInfo = await getCurrentIsp();
    
    if (!ispInfo) {
      return res.status(503).json({ 
        success: false, 
        error: 'Could not detect ISP. Check internet connectivity.' 
      });
    }

    // Also get the matched internet node if any
    const internetNodes = await prisma.node.findMany({
      where: {
        type: 'INTERNET',
        OR: [
          { ispName: { not: null } },
          { ispOrganization: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        ispName: true,
        ispOrganization: true,
      },
    });

    // Find matching node
    const ispLower = ispInfo.isp.toLowerCase();
    const orgLower = ispInfo.org.toLowerCase();
    
    const matchedNode = internetNodes.find(node => {
      if (node.ispName && (
        ispLower.includes(node.ispName.toLowerCase()) ||
        orgLower.includes(node.ispName.toLowerCase())
      )) return true;
      if (node.ispOrganization && (
        ispLower.includes(node.ispOrganization.toLowerCase()) ||
        orgLower.includes(node.ispOrganization.toLowerCase())
      )) return true;
      return false;
    });

    res.json({ 
      success: true, 
      data: {
        ...ispInfo,
        matchedNodeId: matchedNode?.id || null,
        matchedNodeName: matchedNode?.name || null,
      }
    });
  } catch (error) {
    console.error('Error getting ISP info:', error);
    res.status(500).json({ success: false, error: 'Failed to get ISP info' });
  }
});

// POST /api/network/isp/detect - Force ISP detection and auto-switch
networkRouter.post('/isp/detect', async (req: Request, res: Response) => {
  try {
    // Force refresh the ISP cache first
    await forceRefreshIsp();
    
    // Run detection and auto-switch
    const result = await detectAndSwitchIsp();
    
    if (!result.ispInfo) {
      return res.status(503).json({ 
        success: false, 
        error: 'Could not detect ISP. Check internet connectivity.' 
      });
    }

    res.json({ 
      success: true, 
      data: {
        ispInfo: result.ispInfo,
        matchedNodeId: result.matchedNodeId,
        switched: result.switched,
      },
      message: result.switched 
        ? `Switched to ${result.ispInfo.isp}` 
        : result.matchedNodeId 
          ? `ISP ${result.ispInfo.isp} is already active`
          : `No matching INTERNET node found for ${result.ispInfo.isp}`
    });
  } catch (error) {
    console.error('Error detecting ISP:', error);
    res.status(500).json({ success: false, error: 'Failed to detect ISP' });
  }
});
