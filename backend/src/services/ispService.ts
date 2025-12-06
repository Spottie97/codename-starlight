/**
 * ISP Detection Service
 * Detects current ISP by querying external IP info APIs
 * and automatically switches active internet source based on detected ISP
 */

import { prisma } from '../db';
import { broadcastMessage } from './websocketService';
import { triggerIspChanged, isWebhookEnabled } from './webhookService';

// ISP Info from external API
export interface IspInfo {
  publicIp: string;
  isp: string;
  org: string;
  as: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
}

// Cached ISP info
let cachedIspInfo: IspInfo | null = null;
let lastIspCheck: Date | null = null;
const ISP_CHECK_INTERVAL = 60000; // 1 minute cache

/**
 * Query ip-api.com for current ISP information
 * Free tier: 45 requests per minute
 */
async function queryIspApi(): Promise<IspInfo | null> {
  try {
    const response = await fetch('http://ip-api.com/json/?fields=status,message,query,isp,org,as,city,region,country,timezone', {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error('ISP API request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('ISP API returned error:', data.message);
      return null;
    }

    return {
      publicIp: data.query,
      isp: data.isp || '',
      org: data.org || '',
      as: data.as || '',
      city: data.city || '',
      region: data.region || '',
      country: data.country || '',
      timezone: data.timezone || '',
    };
  } catch (error) {
    console.error('Error querying ISP API:', error);
    return null;
  }
}

/**
 * Get current ISP info (with caching)
 */
export async function getCurrentIsp(): Promise<IspInfo | null> {
  const now = new Date();

  // Return cached result if fresh
  if (cachedIspInfo && lastIspCheck && (now.getTime() - lastIspCheck.getTime() < ISP_CHECK_INTERVAL)) {
    return cachedIspInfo;
  }

  // Query fresh ISP info
  const ispInfo = await queryIspApi();
  
  if (ispInfo) {
    cachedIspInfo = ispInfo;
    lastIspCheck = now;
  }

  return ispInfo;
}

/**
 * Match ISP info against an INTERNET node's configuration
 * Returns true if the ISP matches the node's configured ISP
 */
function matchesIsp(ispInfo: IspInfo, node: { ispName: string | null; ispOrganization: string | null }): boolean {
  if (!node.ispName && !node.ispOrganization) {
    return false; // Node not configured for ISP matching
  }

  const ispLower = ispInfo.isp.toLowerCase();
  const orgLower = ispInfo.org.toLowerCase();
  const asLower = ispInfo.as.toLowerCase();

  // Check ispName match (partial match, case-insensitive)
  if (node.ispName) {
    const configuredIsp = node.ispName.toLowerCase();
    if (ispLower.includes(configuredIsp) || 
        orgLower.includes(configuredIsp) ||
        asLower.includes(configuredIsp) ||
        configuredIsp.includes(ispLower.split(' ')[0])) {
      return true;
    }
  }

  // Check organization match
  if (node.ispOrganization) {
    const configuredOrg = node.ispOrganization.toLowerCase();
    if (orgLower.includes(configuredOrg) || 
        ispLower.includes(configuredOrg) ||
        configuredOrg.includes(orgLower.split(' ')[0])) {
      return true;
    }
  }

  return false;
}

/**
 * Detect current ISP and auto-switch active source if needed
 * Returns the matched INTERNET node ID, or null if no match
 */
export async function detectAndSwitchIsp(): Promise<{
  ispInfo: IspInfo | null;
  matchedNodeId: string | null;
  switched: boolean;
}> {
  // Get current ISP
  const ispInfo = await getCurrentIsp();
  
  if (!ispInfo) {
    console.log('⚠️  Could not detect ISP');
    return { ispInfo: null, matchedNodeId: null, switched: false };
  }

  console.log(`🌐 Detected ISP: ${ispInfo.isp} (${ispInfo.org}) - IP: ${ispInfo.publicIp}`);

  // Get all INTERNET nodes with ISP configuration
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

  if (internetNodes.length === 0) {
    console.log('ℹ️  No INTERNET nodes with ISP configuration found');
    return { ispInfo, matchedNodeId: null, switched: false };
  }

  // Find matching node
  const matchedNode = internetNodes.find(node => matchesIsp(ispInfo, node));

  if (!matchedNode) {
    console.log(`⚠️  No INTERNET node matches current ISP: ${ispInfo.isp}`);
    return { ispInfo, matchedNodeId: null, switched: false };
  }

  console.log(`✅ ISP matches node: ${matchedNode.name} (${matchedNode.ispName || matchedNode.ispOrganization})`);

  // Get connections from this INTERNET node
  const connections = await prisma.connection.findMany({
    where: {
      sourceNodeId: matchedNode.id,
    },
    include: {
      targetNode: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  if (connections.length === 0) {
    return { ispInfo, matchedNodeId: matchedNode.id, switched: false };
  }

  // Check if any connection is already active
  const alreadyActive = connections.some(c => c.isActiveSource);
  
  if (alreadyActive) {
    // Already active, no need to switch
    return { ispInfo, matchedNodeId: matchedNode.id, switched: false };
  }

  // Switch to this connection - deactivate others first
  const now = new Date();
  let switched = false;

  for (const connection of connections) {
    // Deactivate other INTERNET connections to the same target
    await prisma.connection.updateMany({
      where: {
        targetNodeId: connection.targetNodeId,
        sourceNode: { type: 'INTERNET' },
        NOT: { id: connection.id },
      },
      data: { isActiveSource: false },
    });

    // Activate this connection
    await prisma.connection.update({
      where: { id: connection.id },
      data: { isActiveSource: true },
    });

    switched = true;

    // Broadcast the change
    broadcastMessage({
      type: 'CONNECTION_ACTIVE_SOURCE_CHANGED',
      payload: {
        connectionId: connection.id,
        targetNodeId: connection.targetNodeId,
        isActiveSource: true,
        detectedIsp: ispInfo.isp,
      },
      timestamp: now.toISOString(),
    });

    console.log(`🔄 Switched active source to ${matchedNode.name} → ${connection.targetNode.name}`);
  }

  // Broadcast ISP info update
  broadcastMessage({
    type: 'ISP_DETECTED',
    payload: {
      ...ispInfo,
      matchedNodeId: matchedNode.id,
      matchedNodeName: matchedNode.name,
    },
    timestamp: now.toISOString(),
  });

  // Trigger webhook for n8n integration
  if (switched && isWebhookEnabled()) {
    triggerIspChanged({
      new_isp: ispInfo.isp,
      public_ip: ispInfo.publicIp,
      matched_node_id: matchedNode.id,
      matched_node_name: matchedNode.name,
    });
  }

  return { ispInfo, matchedNodeId: matchedNode.id, switched };
}

/**
 * Force refresh ISP detection (bypasses cache)
 */
export async function forceRefreshIsp(): Promise<IspInfo | null> {
  cachedIspInfo = null;
  lastIspCheck = null;
  return getCurrentIsp();
}

/**
 * Get cached ISP info without making a new request
 */
export function getCachedIsp(): IspInfo | null {
  return cachedIspInfo;
}
