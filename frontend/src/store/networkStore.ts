import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  NetworkNode, 
  Connection, 
  Status, 
  EditorMode,
  CanvasState,
  NodeStatusUpdatePayload,
} from '../types/network';
import { networkApi, nodesApi, connectionsApi } from '../services/api';

interface NetworkState {
  // Data
  nodes: NetworkNode[];
  connections: Connection[];
  isLoading: boolean;
  error: string | null;

  // Canvas state
  canvas: CanvasState;

  // Editor state
  editorMode: EditorMode;
  selectedNodeId: string | null;
  connectingFromId: string | null;

  // WebSocket connection
  wsConnected: boolean;

  // Actions
  fetchNetwork: () => Promise<void>;
  
  // Node actions
  addNode: (node: NetworkNode) => void;
  updateNode: (id: string, updates: Partial<NetworkNode>) => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeStatus: (payload: NodeStatusUpdatePayload) => void;

  // Connection actions
  addConnection: (connection: Connection) => void;
  removeConnection: (id: string) => void;

  // Selection actions
  setSelectedNode: (id: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  startConnecting: (fromId: string) => void;
  cancelConnecting: () => void;

  // Canvas actions
  setCanvasScale: (scale: number) => void;
  setCanvasOffset: (x: number, y: number) => void;
  resetCanvas: () => void;

  // WebSocket
  setWsConnected: (connected: boolean) => void;

  // Helpers
  getNodeById: (id: string) => NetworkNode | undefined;
  getConnectionsForNode: (nodeId: string) => Connection[];
}

const initialCanvasState: CanvasState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  selectedNodeId: null,
  isConnecting: false,
  connectingFromId: null,
};

export const useNetworkStore = create<NetworkState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    nodes: [],
    connections: [],
    isLoading: false,
    error: null,
    canvas: initialCanvasState,
    editorMode: 'select',
    selectedNodeId: null,
    connectingFromId: null,
    wsConnected: false,

    // Fetch network topology
    fetchNetwork: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await networkApi.getTopology();
        if (response.success && response.data) {
          set({ 
            nodes: response.data.nodes, 
            connections: response.data.connections,
            isLoading: false 
          });
        } else {
          set({ error: response.error || 'Failed to fetch network', isLoading: false });
        }
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch network',
          isLoading: false 
        });
      }
    },

    // Node actions
    addNode: (node) => {
      set((state) => {
        // Prevent duplicates - check if node already exists
        if (state.nodes.some(n => n.id === node.id)) {
          return state; // Node already exists, don't add again
        }
        return { nodes: [...state.nodes, node] };
      });
    },

    updateNode: (id, updates) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, ...updates } : node
        ),
      }));
    },

    removeNode: (id) => {
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== id),
        connections: state.connections.filter(
          (conn) => conn.sourceNodeId !== id && conn.targetNodeId !== id
        ),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      }));
    },

    updateNodePosition: (id, x, y) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, positionX: x, positionY: y } : node
        ),
      }));
    },

    updateNodeStatus: (payload) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== payload.nodeId) return node;
          return {
            ...node,
            status: payload.status ?? node.status,
            internetStatus: payload.internetStatus ?? node.internetStatus,
            latency: payload.latency ?? node.latency,
            lastSeen: payload.lastSeen ?? node.lastSeen,
            internetLastCheck: payload.internetLastCheck ?? node.internetLastCheck,
          };
        }),
      }));
    },

    // Connection actions
    addConnection: (connection) => {
      set((state) => {
        // Prevent duplicates - check if connection already exists
        if (state.connections.some(c => c.id === connection.id)) {
          return state; // Connection already exists, don't add again
        }
        return { connections: [...state.connections, connection] };
      });
    },

    removeConnection: (id) => {
      set((state) => ({
        connections: state.connections.filter((conn) => conn.id !== id),
      }));
    },

    // Selection actions
    setSelectedNode: (id) => {
      set({ selectedNodeId: id });
    },

    setEditorMode: (mode) => {
      set({ 
        editorMode: mode,
        connectingFromId: null,
        selectedNodeId: mode === 'select' ? get().selectedNodeId : null,
      });
    },

    startConnecting: (fromId) => {
      set({ connectingFromId: fromId });
    },

    cancelConnecting: () => {
      set({ connectingFromId: null });
    },

    // Canvas actions
    setCanvasScale: (scale) => {
      set((state) => ({
        canvas: { ...state.canvas, scale: Math.max(0.1, Math.min(3, scale)) },
      }));
    },

    setCanvasOffset: (x, y) => {
      set((state) => ({
        canvas: { ...state.canvas, offsetX: x, offsetY: y },
      }));
    },

    resetCanvas: () => {
      set({ canvas: initialCanvasState });
    },

    // WebSocket
    setWsConnected: (connected) => {
      set({ wsConnected: connected });
    },

    // Helpers
    getNodeById: (id) => {
      return get().nodes.find((node) => node.id === id);
    },

    getConnectionsForNode: (nodeId) => {
      return get().connections.filter(
        (conn) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
      );
    },
  }))
);

// Selectors
export const selectNodes = (state: NetworkState) => state.nodes;
export const selectConnections = (state: NetworkState) => state.connections;
export const selectSelectedNode = (state: NetworkState) => 
  state.selectedNodeId ? state.nodes.find(n => n.id === state.selectedNodeId) : null;
export const selectEditorMode = (state: NetworkState) => state.editorMode;
export const selectCanvasState = (state: NetworkState) => state.canvas;

// Status summary selector
export const selectStatusSummary = (state: NetworkState) => {
  const probes = state.nodes.filter(n => n.type === 'PROBE');
  return {
    total: probes.length,
    online: probes.filter(p => p.status === 'ONLINE').length,
    offline: probes.filter(p => p.status === 'OFFLINE').length,
    degraded: probes.filter(p => p.status === 'DEGRADED').length,
    unknown: probes.filter(p => p.status === 'UNKNOWN').length,
    internetOnline: probes.filter(p => p.internetStatus === 'ONLINE').length,
    internetOffline: probes.filter(p => p.internetStatus === 'OFFLINE').length,
  };
};




