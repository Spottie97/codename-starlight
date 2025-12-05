import type {
  ApiResponse,
  NetworkTopology,
  NetworkNode,
  Connection,
  CreateNodeDTO,
  UpdateNodeDTO,
  CreateConnectionDTO,
  UpdateConnectionDTO,
  ProbeStatusSummary,
  NetworkLayout,
} from '../types/network';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

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



