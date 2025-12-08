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
  triggerInternetStatus,
  triggerGroupDegraded,
  isWebhookEnabled 
} from './webhookService';
import { getPerformanceConfig, cleanupStatusHistory } from './settingsService';

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
let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let currentIntervalMs: number = 60000;

// Track group health for degradation detection
const groupHealthCache = new Map<string, { total: number; offline: number }>();
const internetStatusStability = new Map<string, { status: Status; changedAt: number }>();
const INTERNET_STABILITY_WINDOW_MS = 20000; // require stability before internet webhooks

// Default check interval in milliseconds (minimum 10 seconds)
const MIN_CHECK_INTERVAL = 10000;
const DEFAULT_CHECK_INTERVAL = 60000; // 60 seconds - reduced frequency for better performance
const CLEANUP_INTERVAL = 3600000; // 1 hour - cleanup old status history periodically

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
      latency: true,
      status: true,
      checkInternetAccess: true,
      monitoringMethod: true,
      ipAddress: true,
      snmpCommunity: true,
      snmpVersion: true,
      httpEndpoint: true,
      httpExpectedCode: true,
      outgoingConnections: {
        include: {
          targetNode: {
            select: { id: true, name: true, type: true },
          },
        },
      },
    },
  });

  if (internetNodes.length === 0) {
    return [];
  }

  console.log(`🌐 Checking internet connectivity for ${internetNodes.length} INTERNET nodes...`);

  // Shared fallback internet check (used when per-node polling is not available)
  const sharedInternetCheck = await checkInternetConnectivity();
  const now = new Date();

  // Collect updates for batching
  const nodeUpdates: { id: string; name: string; newInternetStatus: Status; latency: number | null; statusChanged: boolean }[] = [];
  const statusHistoryCreates: { nodeId: string; name: string; newInternetStatus: Status; latency: number | null }[] = [];
  const results: InternetCheckResult[] = [];
  const statusMap = new Map<string, Status>();
  const latencyMap = new Map<string, number | null>();
  const stabilityMap = new Map<string, boolean>();

  for (const node of internetNodes) {
    let newInternetStatus: Status = 'UNKNOWN';
    let latency: number | null = null;

    // If node is definitively offline, keep it offline
    if (node.status === 'OFFLINE') {
      newInternetStatus = 'OFFLINE';
    } else {
      const canPoll =
        node.monitoringMethod !== 'NONE' &&
        node.monitoringMethod !== 'MQTT' &&
        !!node.ipAddress;

      if (canPoll) {
        const pollResult = await checkNode({
          id: node.id,
          monitoringMethod: node.monitoringMethod as MonitoringMethod,
          ipAddress: node.ipAddress,
          snmpCommunity: node.snmpCommunity || 'public',
          snmpVersion: (node.snmpVersion || '2c') as any,
          httpEndpoint: node.httpEndpoint,
          httpExpectedCode: node.httpExpectedCode ?? 200,
        });

        newInternetStatus = pollResult.status;
        latency = pollResult.latency;
      } else {
        // Fallback to shared external connectivity
        newInternetStatus = sharedInternetCheck.alive ? 'ONLINE' : 'OFFLINE';
        latency = sharedInternetCheck.latency;
      }
    }

    const statusChanged = node.internetStatus !== newInternetStatus;
    const previousStability = internetStatusStability.get(node.id);
    const nowMs = now.getTime();

    if (!previousStability || previousStability.status !== newInternetStatus) {
      internetStatusStability.set(node.id, { status: newInternetStatus, changedAt: nowMs });
    }

    const stabilityEntry = internetStatusStability.get(node.id);
    const isStable = stabilityEntry ? (nowMs - stabilityEntry.changedAt) >= INTERNET_STABILITY_WINDOW_MS : false;

    nodeUpdates.push({ id: node.id, name: node.name, newInternetStatus, latency, statusChanged });
    statusMap.set(node.id, newInternetStatus);
    latencyMap.set(node.id, latency);
    stabilityMap.set(node.id, isStable);
    
    if (statusChanged) {
      statusHistoryCreates.push({ nodeId: node.id, name: node.name, newInternetStatus, latency });
      const emoji = newInternetStatus === 'ONLINE' ? '🌐' : '🔴';
      console.log(`${emoji} ${node.name}: Internet ${node.internetStatus} → ${newInternetStatus}`);
    }

    results.push({
      nodeId: node.id,
      internetStatus: newInternetStatus,
      latency,
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
            internetStatus: node.newInternetStatus,
            internetLastCheck: now,
            status: node.newInternetStatus,
            latency: node.latency,
            lastSeen: node.newInternetStatus === 'ONLINE' ? now : undefined,
          },
        })
      ),
      // Batch status history creates (only for status changes)
      ...statusHistoryCreates.map(({ nodeId, newInternetStatus, latency }) =>
        prisma.probeStatus.create({
          data: {
            nodeId,
            status: newInternetStatus,
            internetStatus: newInternetStatus,
            latency: latency ?? null,
            message: newInternetStatus === 'ONLINE' ? 'Internet reachable' : 'Internet unreachable',
          },
        })
      ),
    ]);
  }

  // Broadcast updates in a single batched message
  if (internetNodes.length > 0) {
    const wsPayloads = internetNodes.map(node => {
      const status = statusMap.get(node.id) || 'UNKNOWN';
      const latency = latencyMap.get(node.id) ?? null;
      return {
        nodeId: node.id,
        status,
        internetStatus: status,
        latency,
        lastSeen: status === 'ONLINE' ? now.toISOString() : undefined,
        internetLastCheck: now.toISOString(),
      };
    });
    
    broadcastMessage({
      type: 'BATCH_STATUS_UPDATE',
      payload: { updates: wsPayloads },
      timestamp: now.toISOString(),
    });
  }

  // Decide active internet source per target and auto-switch if current is offline
  const connections = internetNodes.flatMap(node => node.outgoingConnections.map(conn => ({
    connectionId: conn.id,
    sourceNodeId: conn.sourceNodeId,
    sourceNodeName: internetNodes.find(n => n.id === conn.sourceNodeId)?.name || '',
    targetNodeId: conn.targetNodeId,
    targetNodeName: conn.targetNode.name,
    isActiveSource: conn.isActiveSource,
  })));

  const byTarget = connections.reduce<Record<string, typeof connections>>((acc, conn) => {
    acc[conn.targetNodeId] = acc[conn.targetNodeId] || [];
    acc[conn.targetNodeId].push(conn);
    return acc;
  }, {});

  let switchedAny = false;
  const activeConnectionByTarget = new Map<string, string>();

  for (const [targetId, conns] of Object.entries(byTarget)) {
    const currentActive = conns.find(c => c.isActiveSource);
    const onlineCandidates = conns.filter(c => statusMap.get(c.sourceNodeId) === 'ONLINE');
    const nextActive = onlineCandidates[0] || null;

    if ((currentActive && statusMap.get(currentActive.sourceNodeId) !== 'ONLINE') || (!currentActive && nextActive)) {
      if (nextActive) {
        await prisma.connection.updateMany({
          where: { targetNodeId: targetId, sourceNode: { type: 'INTERNET' } },
          data: { isActiveSource: false },
        });

        await prisma.connection.update({
          where: { id: nextActive.connectionId },
          data: { isActiveSource: true },
        });

        broadcastMessage({
          type: 'CONNECTION_ACTIVE_SOURCE_CHANGED',
          payload: {
            connectionId: nextActive.connectionId,
            targetNodeId: nextActive.targetNodeId,
            isActiveSource: true,
          },
          timestamp: now.toISOString(),
        });

        switchedAny = true;
        activeConnectionByTarget.set(targetId, nextActive.connectionId);
      }
    } else if (currentActive) {
      activeConnectionByTarget.set(targetId, currentActive.connectionId);
    }
  }

  // Send consolidated webhook snapshot when anything changes AND states are stable
  const anyStatusChanged = nodeUpdates.some(n => n.statusChanged);
  const allStable = internetNodes.every(n => stabilityMap.get(n.id));

  if (allStable && (anyStatusChanged || switchedAny) && await isWebhookEnabled()) {
    const lines = internetNodes.map(node => ({
      node_id: node.id,
      node_name: node.name,
      status: statusMap.get(node.id) || 'UNKNOWN',
      latency: latencyMap.get(node.id) ?? undefined,
      is_active_source: connections.some(c => c.sourceNodeId === node.id && activeConnectionByTarget.get(c.targetNodeId) === c.connectionId),
    }));

    // Pick first active connection for summary (there may be multiple targets)
    const firstActiveTarget = Array.from(activeConnectionByTarget.entries())[0];
    const activeConnId = firstActiveTarget ? firstActiveTarget[1] : null;
    const activeConn = connections.find(c => c.connectionId === activeConnId);

    triggerInternetStatus({
      lines,
      active_connection: activeConn
        ? {
            connection_id: activeConn.connectionId,
            source_node_id: activeConn.sourceNodeId,
            source_node_name: activeConn.sourceNodeName,
            target_node_id: activeConn.targetNodeId,
            target_node_name: activeConn.targetNodeName,
          }
        : null,
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
    // Get performance configuration from settings
    const perfConfig = await getPerformanceConfig();
    const concurrencyLimit = perfConfig.monitoringConcurrency;
    const enableStatusHistory = perfConfig.enableStatusHistory;

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

    console.log(`🔍 Running monitoring cycle for ${nodes.length} nodes (concurrency: ${concurrencyLimit})...`);

    // Check all nodes in parallel (with configurable concurrency limit)
    const results: MonitoringResult[] = [];

    for (let i = 0; i < nodes.length; i += concurrencyLimit) {
      const batch = nodes.slice(i, i + concurrencyLimit);
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

        // Collect status history only on actual changes (if enabled)
        if (statusChanged && enableStatusHistory) {
          statusHistoryCreates.push({
            nodeId: result.nodeId,
            status: result.status,
            latency: result.latency,
            message: result.error || null,
          });
        }
        
        if (statusChanged) {
          const emoji = result.status === 'ONLINE' ? '✅' : '❌';
          console.log(`${emoji} ${node.name}: ${node.status} → ${result.status}`);

          // Trigger webhook for node status change
          if (await isWebhookEnabled()) {
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
      // Batch node updates
      const nodeUpdateOps = nodeUpdates.map(update => 
        prisma.node.update({
          where: { id: update.nodeId },
          data: {
            status: update.status,
            latency: update.latency,
            lastSeen: update.lastSeen,
          },
        })
      );
      
      // Status history creates (if enabled)
      const historyOps = enableStatusHistory && statusHistoryCreates.length > 0
        ? statusHistoryCreates.map(create =>
            prisma.probeStatus.create({
              data: {
                nodeId: create.nodeId,
                status: create.status,
                latency: create.latency,
                message: create.message,
              },
            })
          )
        : [];
      
      await prisma.$transaction([...nodeUpdateOps, ...historyOps]);
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
    if (await isWebhookEnabled()) {
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
 * @param intervalMs - Check interval in milliseconds (default: 60000)
 */
export function startMonitoringScheduler(intervalMs: number = DEFAULT_CHECK_INTERVAL): void {
  if (monitoringInterval) {
    console.log('⚠️  Monitoring scheduler already running');
    return;
  }

  // Ensure minimum interval
  const interval = Math.max(intervalMs, MIN_CHECK_INTERVAL);
  currentIntervalMs = interval;
  
  console.log(`🚀 Starting monitoring scheduler (interval: ${interval / 1000}s)`);

  // Run initial check after a short delay
  setTimeout(() => {
    runMonitoringCycle();
  }, 5000);

  // Schedule periodic checks
  monitoringInterval = setInterval(() => {
    runMonitoringCycle();
  }, interval);
  
  // Start cleanup interval for status history
  if (!cleanupInterval) {
    cleanupInterval = setInterval(async () => {
      try {
        await cleanupStatusHistory();
      } catch (error) {
        console.error('Error in status history cleanup:', error);
      }
    }, CLEANUP_INTERVAL);
    console.log('🗑️ Status history cleanup scheduled (every hour)');
  }
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
  
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Restart the monitoring scheduler with new settings from database
 * Called when settings are updated
 */
export async function restartMonitoringScheduler(): Promise<void> {
  console.log('🔄 Restarting monitoring scheduler with new settings...');
  
  // Stop current scheduler
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  // Get new interval from settings
  const perfConfig = await getPerformanceConfig();
  const newInterval = Math.max(perfConfig.monitoringIntervalMs, MIN_CHECK_INTERVAL);
  
  if (newInterval !== currentIntervalMs) {
    console.log(`📊 Monitoring interval changed: ${currentIntervalMs / 1000}s → ${newInterval / 1000}s`);
  }
  
  currentIntervalMs = newInterval;
  
  // Start new scheduler
  monitoringInterval = setInterval(() => {
    runMonitoringCycle();
  }, newInterval);
  
  console.log(`✅ Monitoring scheduler restarted (interval: ${newInterval / 1000}s)`);
}

/**
 * Get current monitoring interval
 */
export function getCurrentMonitoringInterval(): number {
  return currentIntervalMs;
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

