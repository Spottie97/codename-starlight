import { prisma } from '../server';
import { Status } from '../types';

/**
 * Check for stale nodes and mark them as offline
 * Runs periodically to detect nodes that haven't sent heartbeats
 */
export async function checkStaleNodes(): Promise<void> {
  const staleThreshold = parseInt(process.env.PROBE_TIMEOUT || '30000', 10);
  const staleTime = new Date(Date.now() - staleThreshold);

  try {
    // Find nodes that haven't been seen recently and are still marked as online
    const staleNodes = await prisma.node.findMany({
      where: {
        type: 'PROBE',
        status: 'ONLINE',
        lastSeen: {
          lt: staleTime,
        },
      },
    });

    // Mark stale nodes as offline
    for (const node of staleNodes) {
      await prisma.node.update({
        where: { id: node.id },
        data: { status: 'OFFLINE' },
      });

      // Record in history
      await prisma.probeStatus.create({
        data: {
          nodeId: node.id,
          status: 'OFFLINE',
          message: 'Node marked offline due to missed heartbeats',
        },
      });

      console.log(`⚠️ Node ${node.name} marked as OFFLINE (stale)`);
    }
  } catch (error) {
    console.error('Error checking stale nodes:', error);
  }
}

/**
 * Get network health summary
 */
export async function getNetworkHealth(): Promise<{
  overall: Status;
  networkHealth: number;
  internetHealth: number;
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
}> {
  const nodes = await prisma.node.findMany({
    where: { type: 'PROBE' },
    select: { status: true, internetStatus: true },
  });

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => n.status === 'ONLINE').length;
  const offlineNodes = nodes.filter((n) => n.status === 'OFFLINE').length;
  const internetOnline = nodes.filter((n) => n.internetStatus === 'ONLINE').length;

  const networkHealth = totalNodes > 0 ? (onlineNodes / totalNodes) * 100 : 0;
  const internetHealth = totalNodes > 0 ? (internetOnline / totalNodes) * 100 : 0;

  let overall: Status = 'ONLINE';
  if (networkHealth < 50) {
    overall = 'OFFLINE';
  } else if (networkHealth < 80) {
    overall = 'DEGRADED';
  }

  return {
    overall,
    networkHealth: Math.round(networkHealth),
    internetHealth: Math.round(internetHealth),
    totalNodes,
    onlineNodes,
    offlineNodes,
  };
}

/**
 * Detect network segments (groups of connected nodes)
 */
export async function detectNetworkSegments(): Promise<Map<string, string[]>> {
  const nodes = await prisma.node.findMany({
    include: {
      outgoingConnections: true,
      incomingConnections: true,
    },
  });

  const segments = new Map<string, string[]>();
  const visited = new Set<string>();

  function dfs(nodeId: string, segment: string[]): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    segment.push(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Visit connected nodes
    const connectedIds = [
      ...node.outgoingConnections.map((c) => c.targetNodeId),
      ...node.incomingConnections.map((c) => c.sourceNodeId),
    ];

    for (const connectedId of connectedIds) {
      dfs(connectedId, segment);
    }
  }

  // Find all segments
  let segmentIndex = 0;
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const segment: string[] = [];
      dfs(node.id, segment);
      segments.set(`segment-${segmentIndex}`, segment);
      segmentIndex++;
    }
  }

  return segments;
}

/**
 * Clean up old status history
 */
export async function cleanupStatusHistory(): Promise<number> {
  const retentionDays = parseInt(process.env.STATUS_HISTORY_RETENTION_DAYS || '30', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.probeStatus.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`🧹 Cleaned up ${result.count} old status records`);
  return result.count;
}

/**
 * Start background tasks
 */
export function startBackgroundTasks(): void {
  // Check for stale nodes every 30 seconds
  setInterval(checkStaleNodes, 30000);

  // Cleanup old history every hour
  setInterval(cleanupStatusHistory, 3600000);

  console.log('✅ Background tasks started');
}





