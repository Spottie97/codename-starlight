/**
 * Monitoring Scheduler Service
 * Runs periodic health checks on all nodes based on their monitoring method
 */

import { prisma } from '../server';
import { broadcastMessage } from './websocketService';
import { pingWithRetry } from './pingService';
import { snmpQueryWithRetry } from './snmpService';
import { httpCheckWithRetry, buildHealthCheckUrl } from './httpService';

// Types
type MonitoringMethod = 'MQTT' | 'PING' | 'SNMP' | 'HTTP' | 'NONE';
type Status = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';

interface MonitoringResult {
  nodeId: string;
  status: Status;
  latency: number | null;
  error?: string;
}

// Monitoring interval handle
let monitoringInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// Default check interval in milliseconds (minimum 10 seconds)
const MIN_CHECK_INTERVAL = 10000;
const DEFAULT_CHECK_INTERVAL = 30000;

/**
 * Check a single node based on its monitoring method
 */
async function checkNode(node: {
  id: string;
  monitoringMethod: MonitoringMethod;
  ipAddress: string | null;
  snmpCommunity: string | null;
  snmpVersion: string;
  httpEndpoint: string | null;
  httpExpectedCode: number;
}): Promise<MonitoringResult> {
  const { id, monitoringMethod, ipAddress } = node;

  // Skip nodes without monitoring configured
  if (monitoringMethod === 'NONE' || monitoringMethod === 'MQTT') {
    return { nodeId: id, status: 'UNKNOWN', latency: null };
  }

  // Need IP address for active monitoring
  if (!ipAddress) {
    return {
      nodeId: id,
      status: 'UNKNOWN',
      latency: null,
      error: 'No IP address configured',
    };
  }

  try {
    switch (monitoringMethod) {
      case 'PING': {
        const result = await pingWithRetry(ipAddress);
        return {
          nodeId: id,
          status: result.alive ? 'ONLINE' : 'OFFLINE',
          latency: result.latency,
          error: result.error,
        };
      }

      case 'SNMP': {
        const result = await snmpQueryWithRetry(
          ipAddress,
          node.snmpCommunity || 'public',
          node.snmpVersion || '2c'
        );
        return {
          nodeId: id,
          status: result.alive ? 'ONLINE' : 'OFFLINE',
          latency: result.latency,
          error: result.error,
        };
      }

      case 'HTTP': {
        const url = node.httpEndpoint || buildHealthCheckUrl(ipAddress);
        const result = await httpCheckWithRetry(
          url,
          node.httpExpectedCode || 200
        );
        return {
          nodeId: id,
          status: result.alive ? 'ONLINE' : 'OFFLINE',
          latency: result.latency,
          error: result.error,
        };
      }

      default:
        return { nodeId: id, status: 'UNKNOWN', latency: null };
    }
  } catch (error) {
    console.error(`Error checking node ${id}:`, error);
    return {
      nodeId: id,
      status: 'OFFLINE',
      latency: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run a monitoring check cycle for all active nodes
 */
async function runMonitoringCycle(): Promise<void> {
  if (isRunning) {
    console.log('⏭️  Skipping monitoring cycle - previous cycle still running');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // Get all nodes with active monitoring (not MQTT or NONE)
    const nodes = await prisma.node.findMany({
      where: {
        monitoringMethod: {
          in: ['PING', 'SNMP', 'HTTP'],
        },
      },
      select: {
        id: true,
        name: true,
        monitoringMethod: true,
        ipAddress: true,
        snmpCommunity: true,
        snmpVersion: true,
        httpEndpoint: true,
        httpExpectedCode: true,
        status: true,
      },
    });

    if (nodes.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`🔍 Running monitoring cycle for ${nodes.length} nodes...`);

    // Check all nodes in parallel (with concurrency limit)
    const CONCURRENCY_LIMIT = 10;
    const results: MonitoringResult[] = [];

    for (let i = 0; i < nodes.length; i += CONCURRENCY_LIMIT) {
      const batch = nodes.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((node) => checkNode(node as any))
      );
      results.push(...batchResults);
    }

    // Update database and broadcast changes
    const now = new Date();
    let updatedCount = 0;

    for (const result of results) {
      const node = nodes.find((n) => n.id === result.nodeId);
      if (!node) continue;

      // Only update if status changed or we have latency data
      const statusChanged = node.status !== result.status;
      
      if (statusChanged || result.latency !== null) {
        // Update database
        await prisma.node.update({
          where: { id: result.nodeId },
          data: {
            status: result.status,
            latency: result.latency,
            lastSeen: result.status === 'ONLINE' ? now : undefined,
          },
        });

        // Record status history
        await prisma.probeStatus.create({
          data: {
            nodeId: result.nodeId,
            status: result.status,
            latency: result.latency,
            message: result.error || null,
          },
        });

        // Broadcast update via WebSocket
        broadcastMessage({
          type: 'NODE_STATUS_UPDATE',
          payload: {
            nodeId: result.nodeId,
            status: result.status,
            latency: result.latency,
            lastSeen: result.status === 'ONLINE' ? now.toISOString() : undefined,
          },
          timestamp: now.toISOString(),
        });

        updatedCount++;

        // Log status changes
        if (statusChanged) {
          const emoji = result.status === 'ONLINE' ? '✅' : '❌';
          console.log(`${emoji} ${node.name}: ${node.status} → ${result.status}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✔️  Monitoring cycle complete: ${updatedCount}/${nodes.length} updated in ${duration}ms`);

  } catch (error) {
    console.error('Error in monitoring cycle:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the monitoring scheduler
 * @param intervalMs - Check interval in milliseconds (default: 30000)
 */
export function startMonitoringScheduler(intervalMs: number = DEFAULT_CHECK_INTERVAL): void {
  if (monitoringInterval) {
    console.log('⚠️  Monitoring scheduler already running');
    return;
  }

  // Ensure minimum interval
  const interval = Math.max(intervalMs, MIN_CHECK_INTERVAL);
  
  console.log(`🚀 Starting monitoring scheduler (interval: ${interval / 1000}s)`);

  // Run initial check after a short delay
  setTimeout(() => {
    runMonitoringCycle();
  }, 5000);

  // Schedule periodic checks
  monitoringInterval = setInterval(() => {
    runMonitoringCycle();
  }, interval);
}

/**
 * Stop the monitoring scheduler
 */
export function stopMonitoringScheduler(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Monitoring scheduler stopped');
  }
}

/**
 * Manually trigger a monitoring cycle
 */
export async function triggerMonitoringCycle(): Promise<void> {
  await runMonitoringCycle();
}

/**
 * Check a specific node immediately
 * @param nodeId - The ID of the node to check
 */
export async function checkNodeNow(nodeId: string): Promise<MonitoringResult | null> {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      monitoringMethod: true,
      ipAddress: true,
      snmpCommunity: true,
      snmpVersion: true,
      httpEndpoint: true,
      httpExpectedCode: true,
    },
  });

  if (!node) {
    return null;
  }

  const result = await checkNode(node as any);

  // Update database
  const now = new Date();
  await prisma.node.update({
    where: { id: nodeId },
    data: {
      status: result.status,
      latency: result.latency,
      lastSeen: result.status === 'ONLINE' ? now : undefined,
    },
  });

  // Broadcast update
  broadcastMessage({
    type: 'NODE_STATUS_UPDATE',
    payload: {
      nodeId: result.nodeId,
      status: result.status,
      latency: result.latency,
      lastSeen: result.status === 'ONLINE' ? now.toISOString() : undefined,
    },
    timestamp: now.toISOString(),
  });

  return result;
}

