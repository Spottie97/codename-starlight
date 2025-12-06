/**
 * Monitoring Scheduler Service
 * Runs periodic health checks on all nodes based on their monitoring method
 */

import { prisma } from '../db';
import { broadcastMessage } from './websocketService';
import { pingWithRetry, pingHost } from './pingService';
import { snmpQueryWithRetry } from './snmpService';
import { httpCheckWithRetry, buildHealthCheckUrl } from './httpService';
import { detectAndSwitchIsp } from './ispService';
import { 
  triggerNodeDown, 
  triggerNodeUp, 
  triggerInternetDown, 
  triggerInternetUp,
  triggerGroupDegraded,
  isWebhookEnabled 
} from './webhookService';

// Types
type MonitoringMethod = 'MQTT' | 'PING' | 'SNMP' | 'HTTP' | 'NONE';
type NodeType = 'PROBE' | 'ROUTER' | 'SWITCH' | 'SERVER' | 'GATEWAY' | 'ACCESS_POINT' | 'FIREWALL' | 'VIRTUAL' | 'INTERNET' | 'MAIN_LINK';
type Status = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';

// External DNS servers for internet connectivity checks
const EXTERNAL_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

interface MonitoringResult {
  nodeId: string;
  status: Status;
  latency: number | null;
  error?: string;
}

interface InternetCheckResult {
  nodeId: string;
  internetStatus: Status;
  latency: number | null;
}

// Monitoring interval handle
let monitoringInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// Track group health for degradation detection
const groupHealthCache = new Map<string, { total: number; offline: number }>();

// Default check interval in milliseconds (minimum 10 seconds)
const MIN_CHECK_INTERVAL = 10000;
const DEFAULT_CHECK_INTERVAL = 60000; // 60 seconds - reduced frequency for better performance

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
 * Check internet connectivity by pinging external DNS servers
 * Returns ONLINE if at least one server responds
 */
async function checkInternetConnectivity(): Promise<{ alive: boolean; latency: number | null }> {
  try {
    // Ping all external servers in parallel
    const results = await Promise.all(
      EXTERNAL_DNS_SERVERS.map(server => pingHost(server, 3))
    );

    // Find the first successful result
    const successfulResult = results.find(r => r.alive);
    
    if (successfulResult) {
      return {
        alive: true,
        latency: successfulResult.latency,
      };
    }

    return { alive: false, latency: null };
  } catch (error) {
    console.error('Error checking internet connectivity:', error);
    return { alive: false, latency: null };
  }
}

/**
 * Check internet connectivity for INTERNET type nodes
 * These nodes represent external internet connections and are checked against external DNS
 */
async function checkInternetNodes(): Promise<InternetCheckResult[]> {
  const internetNodes = await prisma.node.findMany({
    where: {
      type: 'INTERNET',
    },
    select: {
      id: true,
      name: true,
      internetStatus: true,
    },
  });

  if (internetNodes.length === 0) {
    return [];
  }

  console.log(`🌐 Checking internet connectivity for ${internetNodes.length} INTERNET nodes...`);

  // Check internet connectivity once (shared result for all internet nodes)
  const internetCheck = await checkInternetConnectivity();
  const now = new Date();
  const newStatus: Status = internetCheck.alive ? 'ONLINE' : 'OFFLINE';

  // Collect updates for batching
  const nodeUpdates: { id: string; name: string; statusChanged: boolean }[] = [];
  const statusHistoryCreates: { nodeId: string; name: string }[] = [];
  const results: InternetCheckResult[] = [];

  for (const node of internetNodes) {
    const statusChanged = node.internetStatus !== newStatus;
    nodeUpdates.push({ id: node.id, name: node.name, statusChanged });
    
    if (statusChanged) {
      statusHistoryCreates.push({ nodeId: node.id, name: node.name });
      const emoji = newStatus === 'ONLINE' ? '🌐' : '🔴';
      console.log(`${emoji} ${node.name}: Internet ${node.internetStatus} → ${newStatus}`);

      // Trigger webhook for internet status change
      if (isWebhookEnabled()) {
        const webhookData = {
          node_id: node.id,
          node_name: node.name,
          previous_status: node.internetStatus,
          new_status: newStatus,
          latency: internetCheck.latency || undefined,
        };

        if (newStatus === 'OFFLINE') {
          triggerInternetDown(webhookData);
        } else if (newStatus === 'ONLINE' && node.internetStatus === 'OFFLINE') {
          triggerInternetUp(webhookData);
        }
      }
    }

    results.push({
      nodeId: node.id,
      internetStatus: newStatus,
      latency: internetCheck.latency,
    });
  }

  // Execute all database updates in a single transaction
  if (nodeUpdates.length > 0) {
    await prisma.$transaction([
      // Batch node updates
      ...nodeUpdates.map(node => 
        prisma.node.update({
          where: { id: node.id },
          data: {
            internetStatus: newStatus,
            internetLastCheck: now,
            status: newStatus,
            latency: internetCheck.latency,
            lastSeen: internetCheck.alive ? now : undefined,
          },
        })
      ),
      // Batch status history creates (only for status changes)
      ...statusHistoryCreates.map(({ nodeId }) =>
        prisma.probeStatus.create({
          data: {
            nodeId,
            status: newStatus,
            internetStatus: newStatus,
            latency: internetCheck.latency,
            message: internetCheck.alive ? 'Internet reachable' : 'Internet unreachable',
          },
        })
      ),
    ]);
  }

  // Broadcast updates in a single batched message
  if (internetNodes.length > 0) {
    const wsPayloads = internetNodes.map(node => ({
      nodeId: node.id,
      status: newStatus,
      internetStatus: newStatus,
      latency: internetCheck.latency,
      lastSeen: internetCheck.alive ? now.toISOString() : undefined,
      internetLastCheck: now.toISOString(),
    }));
    
    broadcastMessage({
      type: 'BATCH_STATUS_UPDATE',
      payload: { updates: wsPayloads },
      timestamp: now.toISOString(),
    });
  }

  return results;
}

/**
 * Check internet access for nodes with checkInternetAccess enabled
 * This is separate from INTERNET type nodes - these are regular nodes that want to verify
 * their internet connectivity (e.g., a server that needs WAN access)
 */
async function checkNodesInternetAccess(): Promise<InternetCheckResult[]> {
  const nodes = await prisma.node.findMany({
    where: {
      checkInternetAccess: true,
      type: { not: 'INTERNET' }, // INTERNET nodes are handled separately
    },
    select: {
      id: true,
      name: true,
      status: true,
      internetStatus: true,
    },
  });

  if (nodes.length === 0) {
    return [];
  }

  console.log(`🌍 Checking internet access for ${nodes.length} nodes with checkInternetAccess enabled...`);

  // Check internet connectivity once (shared result)
  const internetCheck = await checkInternetConnectivity();
  const now = new Date();

  // Collect updates for batching
  const nodeUpdates: { id: string; name: string; newInternetStatus: Status; statusChanged: boolean }[] = [];
  const results: InternetCheckResult[] = [];

  for (const node of nodes) {
    // Only check internet if the node is locally reachable
    let newInternetStatus: Status;
    
    if (node.status === 'OFFLINE') {
      newInternetStatus = 'OFFLINE';
    } else if (node.status === 'UNKNOWN') {
      continue;
    } else {
      newInternetStatus = internetCheck.alive ? 'ONLINE' : 'OFFLINE';
    }

    const statusChanged = node.internetStatus !== newInternetStatus;
    nodeUpdates.push({ id: node.id, name: node.name, newInternetStatus, statusChanged });

    results.push({
      nodeId: node.id,
      internetStatus: newInternetStatus,
      latency: internetCheck.latency,
    });

    if (statusChanged) {
      const emoji = newInternetStatus === 'ONLINE' ? '🌍' : '🔴';
      console.log(`${emoji} ${node.name}: Internet access ${node.internetStatus} → ${newInternetStatus}`);
    }
  }

  // Execute all database updates in a single transaction
  if (nodeUpdates.length > 0) {
    await prisma.$transaction(
      nodeUpdates.map(node => 
        prisma.node.update({
          where: { id: node.id },
          data: {
            internetStatus: node.newInternetStatus,
            internetLastCheck: now,
          },
        })
      )
    );
  }

  // Broadcast updates in a single batched message
  if (nodeUpdates.length > 0) {
    const wsPayloads = nodeUpdates.map(update => ({
      nodeId: update.id,
      internetStatus: update.newInternetStatus,
      internetLastCheck: now.toISOString(),
    }));
    
    broadcastMessage({
      type: 'BATCH_STATUS_UPDATE',
      payload: { updates: wsPayloads },
      timestamp: now.toISOString(),
    });
  }

  return results;
}

/**
 * Check for group degradation and trigger webhooks
 * Triggers when 50% or more nodes in a group are offline
 */
async function checkGroupDegradation(): Promise<void> {
  try {
    // Get all groups with their node counts
    const groups = await prisma.nodeGroup.findMany({
      include: {
        nodes: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    for (const group of groups) {
      if (group.nodes.length === 0) continue;

      const offlineNodes = group.nodes.filter(n => n.status === 'OFFLINE');
      const offlineCount = offlineNodes.length;
      const totalCount = group.nodes.length;
      const offlinePercentage = offlineCount / totalCount;

      // Get previous state
      const previousState = groupHealthCache.get(group.id);
      const wasHealthy = !previousState || (previousState.offline / previousState.total) < 0.5;
      const isNowDegraded = offlinePercentage >= 0.5;

      // Update cache
      groupHealthCache.set(group.id, { total: totalCount, offline: offlineCount });

      // Only trigger if transitioning to degraded state
      if (isNowDegraded && wasHealthy && offlineCount > 0) {
        console.log(`⚠️  Group "${group.name}" is degraded: ${offlineCount}/${totalCount} nodes offline`);
        
        triggerGroupDegraded({
          group_id: group.id,
          group_name: group.name,
          total_nodes: totalCount,
          offline_nodes: offlineCount,
          affected_node_names: offlineNodes.map(n => n.name),
        });
      }
    }
  } catch (error) {
    console.error('Error checking group degradation:', error);
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

    // Collect updates for batch processing
    const now = new Date();
    const nodeUpdates: { nodeId: string; status: Status; latency: number | null; lastSeen?: Date }[] = [];
    const statusHistoryCreates: { nodeId: string; status: Status; latency: number | null; message: string | null }[] = [];
    const wsPayloads: { nodeId: string; status: Status; latency: number | null; lastSeen?: string }[] = [];

    for (const result of results) {
      const node = nodes.find((n) => n.id === result.nodeId);
      if (!node) continue;

      const statusChanged = node.status !== result.status;
      
      if (statusChanged || result.latency !== null) {
        // Collect node update
        nodeUpdates.push({
          nodeId: result.nodeId,
          status: result.status,
          latency: result.latency,
          lastSeen: result.status === 'ONLINE' ? now : undefined,
        });

        // Collect status history only on actual changes
        if (statusChanged) {
          statusHistoryCreates.push({
            nodeId: result.nodeId,
            status: result.status,
            latency: result.latency,
            message: result.error || null,
          });
          
          const emoji = result.status === 'ONLINE' ? '✅' : '❌';
          console.log(`${emoji} ${node.name}: ${node.status} → ${result.status}`);

          // Trigger webhook for node status change
          if (isWebhookEnabled()) {
            const webhookData = {
              node_id: node.id,
              node_name: node.name,
              node_type: node.monitoringMethod,
              ip_address: node.ipAddress || undefined,
              previous_status: node.status,
              new_status: result.status,
              latency: result.latency || undefined,
            };

            if (result.status === 'OFFLINE') {
              triggerNodeDown(webhookData);
            } else if (result.status === 'ONLINE' && node.status === 'OFFLINE') {
              triggerNodeUp(webhookData);
            }
          }
        }

        // Collect WebSocket payload
        wsPayloads.push({
          nodeId: result.nodeId,
          status: result.status,
          latency: result.latency,
          lastSeen: result.status === 'ONLINE' ? now.toISOString() : undefined,
        });
      }
    }

    // Execute all database updates in a single transaction (much more efficient)
    if (nodeUpdates.length > 0) {
      await prisma.$transaction([
        // Batch node updates
        ...nodeUpdates.map(update => 
          prisma.node.update({
            where: { id: update.nodeId },
            data: {
              status: update.status,
              latency: update.latency,
              lastSeen: update.lastSeen,
            },
          })
        ),
        // Batch status history creates (only for actual changes)
        ...statusHistoryCreates.map(create =>
          prisma.probeStatus.create({
            data: {
              nodeId: create.nodeId,
              status: create.status,
              latency: create.latency,
              message: create.message,
            },
          })
        ),
      ]);
    }

    // Broadcast all WebSocket updates in a single batched message (much more efficient)
    if (wsPayloads.length > 0) {
      broadcastMessage({
        type: 'BATCH_STATUS_UPDATE',
        payload: { updates: wsPayloads },
        timestamp: now.toISOString(),
      });
    }

    const updatedCount = nodeUpdates.length;

    // Also check internet nodes (INTERNET type nodes)
    await checkInternetNodes();

    // Check internet access for nodes with checkInternetAccess enabled
    await checkNodesInternetAccess();

    // Detect ISP and auto-switch active source if needed
    await detectAndSwitchIsp();

    // Check for group degradation (webhook trigger)
    if (isWebhookEnabled()) {
      await checkGroupDegradation();
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

/**
 * Check internet connectivity status (can be called externally)
 */
export async function getInternetStatus(): Promise<{ alive: boolean; latency: number | null }> {
  return checkInternetConnectivity();
}

/**
 * Trigger internet check for all INTERNET nodes
 */
export async function triggerInternetCheck(): Promise<InternetCheckResult[]> {
  return checkInternetNodes();
}

