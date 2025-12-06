import type {
  ApiResponse,
  NetworkTopology,
  NetworkNode,
  Connection,
  NodeGroup,
  GroupConnection,
  CreateNodeDTO,
  UpdateNodeDTO,
  CreateConnectionDTO,
  UpdateConnectionDTO,
  CreateGroupDTO,
  UpdateGroupDTO,
  CreateGroupConnectionDTO,
  UpdateGroupConnectionDTO,
  ProbeStatusSummary,
  NetworkLayout,
} from '../types/network';
import { getAuthToken, clearAuth } from '../context/AuthContext';

// In development (port 8080), connect directly to backend on localhost:4000
// In production, use relative URLs (same host)
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  return window.location.port === '8080' 
    ? 'http://localhost:4000'  // Development: connect directly to backend
    : '';  // Production: same host, use relative URLs
})();

/**
 * Fetch wrapper with error handling and authentication
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    // Get auth token
    const token = getAuthToken();
    
    // Build headers with auth token
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - clear auth and redirect to login
    if (response.status === 401) {
      clearAuth();
      return {
        success: false,
        error: 'Unauthorized - please log in again',
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error: ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Network API
// ============================================

export const networkApi = {
  /**
   * Get full network topology
   */
  getTopology: () => fetchApi<NetworkTopology>('/api/network'),

  /**
   * Get saved layouts
   */
  getLayouts: () => fetchApi<NetworkLayout[]>('/api/network/layouts'),

  /**
   * Save current layout
   */
  saveLayout: (name: string, description?: string, isDefault?: boolean) =>
    fetchApi<NetworkLayout>('/api/network/layouts', {
      method: 'POST',
      body: JSON.stringify({ name, description, isDefault }),
    }),

  /**
   * Load a saved layout
   */
  loadLayout: (layoutId: string) =>
    fetchApi<{ nodes: number; connections: number }>(
      `/api/network/layouts/${layoutId}/load`,
      { method: 'POST' }
    ),

  /**
   * Delete a layout
   */
  deleteLayout: (layoutId: string) =>
    fetchApi<void>(`/api/network/layouts/${layoutId}`, { method: 'DELETE' }),

  /**
   * Get current ISP information
   */
  getCurrentIsp: () =>
    fetchApi<{
      publicIp: string;
      isp: string;
      org: string;
      as: string;
      city: string;
      region: string;
      country: string;
      timezone: string;
      matchedNodeId: string | null;
      matchedNodeName: string | null;
    }>('/api/network/isp'),

  /**
   * Force ISP detection and auto-switch active source
   */
  detectIsp: () =>
    fetchApi<{
      ispInfo: {
        publicIp: string;
        isp: string;
        org: string;
        as: string;
        city: string;
        region: string;
        country: string;
        timezone: string;
      };
      matchedNodeId: string | null;
      switched: boolean;
    }>('/api/network/isp/detect', { method: 'POST' }),
};

// ============================================
// Nodes API
// ============================================

export const nodesApi = {
  /**
   * Get all nodes
   */
  getAll: () => fetchApi<NetworkNode[]>('/api/nodes'),

  /**
   * Get single node
   */
  getById: (id: string) => fetchApi<NetworkNode>(`/api/nodes/${id}`),

  /**
   * Create new node
   */
  create: (data: CreateNodeDTO) =>
    fetchApi<NetworkNode>('/api/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update node
   */
  update: (id: string, data: UpdateNodeDTO) =>
    fetchApi<NetworkNode>(`/api/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Update node position
   */
  updatePosition: (id: string, positionX: number, positionY: number) =>
    fetchApi<NetworkNode>(`/api/nodes/${id}/position`, {
      method: 'PATCH',
      body: JSON.stringify({ positionX, positionY }),
    }),

  /**
   * Delete node
   */
  delete: (id: string) =>
    fetchApi<void>(`/api/nodes/${id}`, { method: 'DELETE' }),
};

// ============================================
// Connections API
// ============================================

export const connectionsApi = {
  /**
   * Get all connections
   */
  getAll: () => fetchApi<Connection[]>('/api/connections'),

  /**
   * Create connection
   */
  create: (data: CreateConnectionDTO) =>
    fetchApi<Connection>('/api/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update connection
   */
  update: (id: string, data: UpdateConnectionDTO) =>
    fetchApi<Connection>(`/api/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Delete connection
   */
  delete: (id: string) =>
    fetchApi<void>(`/api/connections/${id}`, { method: 'DELETE' }),

  /**
   * Set connection as active internet source
   * This will deactivate other connections from INTERNET nodes to the same target
   */
  setActiveSource: (id: string) =>
    fetchApi<Connection>(`/api/connections/${id}/set-active`, {
      method: 'PATCH',
    }),

  /**
   * Get all active internet source connections
   */
  getActiveSources: () =>
    fetchApi<Connection[]>('/api/connections/internet/active-sources'),
};

// ============================================
// Groups API
// ============================================

export const groupsApi = {
  /**
   * Get all groups
   */
  getAll: () => fetchApi<NodeGroup[]>('/api/groups'),

  /**
   * Get single group with its nodes
   */
  getById: (id: string) => fetchApi<NodeGroup & { nodes: NetworkNode[] }>(`/api/groups/${id}`),

  /**
   * Create new group
   */
  create: (data: CreateGroupDTO) =>
    fetchApi<NodeGroup>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update group
   */
  update: (id: string, data: UpdateGroupDTO) =>
    fetchApi<NodeGroup>(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Update group position and/or size
   */
  updatePosition: (id: string, position: { positionX?: number; positionY?: number; width?: number; height?: number }) =>
    fetchApi<NodeGroup>(`/api/groups/${id}/position`, {
      method: 'PATCH',
      body: JSON.stringify(position),
    }),

  /**
   * Assign a node to a group
   */
  assignNode: (groupId: string, nodeId: string) =>
    fetchApi<NetworkNode>(`/api/groups/${groupId}/assign-node`, {
      method: 'POST',
      body: JSON.stringify({ nodeId }),
    }),

  /**
   * Remove a node from a group
   */
  unassignNode: (groupId: string, nodeId: string) =>
    fetchApi<NetworkNode>(`/api/groups/${groupId}/unassign-node`, {
      method: 'POST',
      body: JSON.stringify({ nodeId }),
    }),

  /**
   * Delete group (nodes remain, just unassigned)
   */
  delete: (id: string) =>
    fetchApi<void>(`/api/groups/${id}`, { method: 'DELETE' }),
};

// ============================================
// Group Connections API
// ============================================

export const groupConnectionsApi = {
  /**
   * Get all group connections
   */
  getAll: () => fetchApi<GroupConnection[]>('/api/group-connections'),

  /**
   * Create group connection
   */
  create: (data: CreateGroupConnectionDTO) =>
    fetchApi<GroupConnection>('/api/group-connections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update group connection
   */
  update: (id: string, data: UpdateGroupConnectionDTO) =>
    fetchApi<GroupConnection>(`/api/group-connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Delete group connection
   */
  delete: (id: string) =>
    fetchApi<void>(`/api/group-connections/${id}`, { method: 'DELETE' }),
};

// ============================================
// Probes API
// ============================================

export const probesApi = {
  /**
   * Get probe status summary
   */
  getSummary: () => fetchApi<ProbeStatusSummary>('/api/probes/summary'),

  /**
   * Get all probe statuses
   */
  getStatus: () =>
    fetchApi<
      Array<{
        id: string;
        name: string;
        status: string;
        internetStatus: string;
        latency: number | null;
        lastSeen: string | null;
      }>
    >('/api/probes/status'),

  /**
   * Get probe history
   */
  getHistory: (nodeId: string, limit?: number) =>
    fetchApi<
      Array<{
        id: string;
        status: string;
        latency: number | null;
        internetStatus: string | null;
        timestamp: string;
      }>
    >(`/api/probes/${nodeId}/history${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get recent outages
   */
  getOutages: (hours?: number) =>
    fetchApi<
      Array<{
        node: { id: string; name: string };
        outages: Array<{ id: string; timestamp: string; message: string | null }>;
      }>
    >(`/api/probes/outages${hours ? `?hours=${hours}` : ''}`),
};

// ============================================
// Health Check
// ============================================

export const healthApi = {
  check: () =>
    fetchApi<{ status: string; timestamp: string; service: string }>('/health'),
};




