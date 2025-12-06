import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  NetworkNode, 
  Connection, 
  NodeGroup,
  GroupConnection,
  EditorMode,
  CanvasState,
  NodeStatusUpdatePayload,
} from '../types/network';
import { networkApi, nodesApi, groupsApi } from '../services/api';

// Layout constants for auto-arrange
const LAYOUT_CONFIG = {
  startX: 100,
  startY: 100,
  groupHorizontalSpacing: 100,
  groupVerticalSpacing: 150,
  nodeHorizontalSpacing: 120,
  nodeVerticalSpacing: 80,
  groupPadding: 40,
  groupHeaderHeight: 32,
  minGroupWidth: 200,
  minGroupHeight: 150,
};

interface NetworkState {
  // Data
  nodes: NetworkNode[];
  connections: Connection[];
  groups: NodeGroup[];
  groupConnections: GroupConnection[];
  isLoading: boolean;
  error: string | null;

  // Canvas state
  canvas: CanvasState;

  // Editor state
  editorMode: EditorMode;
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  connectingFromId: string | null;
  connectingFromGroupId: string | null;

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
  batchUpdateNodeStatus: (updates: NodeStatusUpdatePayload[]) => void;

  // Connection actions
  addConnection: (connection: Connection) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  setActiveSource: (connectionId: string, targetNodeId: string) => void;

  // Group actions
  addGroup: (group: NodeGroup) => void;
  updateGroup: (id: string, updates: Partial<NodeGroup>) => void;
  removeGroup: (id: string) => void;
  updateGroupPosition: (id: string, x: number, y: number, width?: number, height?: number) => void;
  assignNodeToGroup: (nodeId: string, groupId: string | null) => void;

  // Group connection actions
  addGroupConnection: (connection: GroupConnection) => void;
  removeGroupConnection: (id: string) => void;
  startConnectingGroups: (fromGroupId: string) => void;
  cancelConnectingGroups: () => void;

  // Selection actions
  setSelectedNode: (id: string | null) => void;
  setSelectedGroup: (id: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  startConnecting: (fromId: string) => void;
  cancelConnecting: () => void;

  // Canvas actions
  setCanvasScale: (scale: number) => void;
  setCanvasOffset: (x: number, y: number) => void;
  setCanvasTransform: (scale: number, offsetX: number, offsetY: number) => void;
  resetCanvas: () => void;

  // WebSocket
  setWsConnected: (connected: boolean) => void;

  // Layout actions
  autoArrangeLayout: () => Promise<void>;

  // Helpers
  getNodeById: (id: string) => NetworkNode | undefined;
  getGroupById: (id: string) => NodeGroup | undefined;
  getNodesInGroup: (groupId: string) => NetworkNode[];
  getConnectionsForNode: (nodeId: string) => Connection[];
  getGroupConnectionsForGroup: (groupId: string) => GroupConnection[];
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
    groups: [],
    groupConnections: [],
    isLoading: false,
    error: null,
    canvas: initialCanvasState,
    editorMode: 'select',
    selectedNodeId: null,
    selectedGroupId: null,
    connectingFromId: null,
    connectingFromGroupId: null,
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
            groups: response.data.groups || [],
            groupConnections: response.data.groupConnections || [],
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

    // Batch update multiple node statuses at once (more efficient - single state update)
    batchUpdateNodeStatus: (updates) => {
      if (updates.length === 0) return;
      
      set((state) => {
        // Create a map for O(1) lookup of updates by nodeId
        const updateMap = new Map(updates.map(u => [u.nodeId, u]));
        
        return {
          nodes: state.nodes.map((node) => {
            const update = updateMap.get(node.id);
            if (!update) return node;
            
            return {
              ...node,
              status: update.status ?? node.status,
              internetStatus: update.internetStatus ?? node.internetStatus,
              latency: update.latency ?? node.latency,
              lastSeen: update.lastSeen ?? node.lastSeen,
              internetLastCheck: update.internetLastCheck ?? node.internetLastCheck,
            };
          }),
        };
      });
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

    updateConnection: (id, updates) => {
      set((state) => ({
        connections: state.connections.map((conn) =>
          conn.id === id ? { ...conn, ...updates } : conn
        ),
      }));
    },

    removeConnection: (id) => {
      set((state) => ({
        connections: state.connections.filter((conn) => conn.id !== id),
      }));
    },

    // Set a connection as the active internet source
    // This will deactivate other connections to the same target from INTERNET nodes
    setActiveSource: (connectionId, targetNodeId) => {
      set((state) => ({
        connections: state.connections.map((conn) => {
          // If this is the active connection, set it active
          if (conn.id === connectionId) {
            return { ...conn, isActiveSource: true };
          }
          // Deactivate other connections to the same target from INTERNET nodes
          if (conn.targetNodeId === targetNodeId && conn.isActiveSource) {
            const sourceNode = state.nodes.find(n => n.id === conn.sourceNodeId);
            if (sourceNode?.type === 'INTERNET') {
              return { ...conn, isActiveSource: false };
            }
          }
          return conn;
        }),
      }));
    },

    // Group actions
    addGroup: (group) => {
      set((state) => {
        // Prevent duplicates
        if (state.groups.some(g => g.id === group.id)) {
          return state;
        }
        return { groups: [...state.groups, group] };
      });
    },

    updateGroup: (id, updates) => {
      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === id ? { ...group, ...updates } : group
        ),
      }));
    },

    removeGroup: (id) => {
      set((state) => ({
        groups: state.groups.filter((group) => group.id !== id),
        // Remove group connections involving this group
        groupConnections: state.groupConnections.filter(
          (conn) => conn.sourceGroupId !== id && conn.targetGroupId !== id
        ),
        // Unassign nodes from deleted group
        nodes: state.nodes.map((node) =>
          node.groupId === id ? { ...node, groupId: null } : node
        ),
        selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
      }));
    },

    updateGroupPosition: (id, x, y, width, height) => {
      set((state) => ({
        groups: state.groups.map((group) =>
          group.id === id
            ? {
                ...group,
                positionX: x,
                positionY: y,
                ...(width !== undefined && { width }),
                ...(height !== undefined && { height }),
              }
            : group
        ),
      }));
    },

    assignNodeToGroup: (nodeId, groupId) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, groupId } : node
        ),
      }));
    },

    // Group connection actions
    addGroupConnection: (connection) => {
      set((state) => {
        // Prevent duplicates
        if (state.groupConnections.some(c => c.id === connection.id)) {
          return state;
        }
        return { groupConnections: [...state.groupConnections, connection] };
      });
    },

    removeGroupConnection: (id) => {
      set((state) => ({
        groupConnections: state.groupConnections.filter((conn) => conn.id !== id),
      }));
    },

    startConnectingGroups: (fromGroupId) => {
      set({ connectingFromGroupId: fromGroupId });
    },

    cancelConnectingGroups: () => {
      set({ connectingFromGroupId: null });
    },

    // Selection actions
    setSelectedNode: (id) => {
      set({ selectedNodeId: id, selectedGroupId: null });
    },

    setSelectedGroup: (id) => {
      set({ selectedGroupId: id, selectedNodeId: null });
    },

    setEditorMode: (mode) => {
      set({ 
        editorMode: mode,
        connectingFromId: null,
        connectingFromGroupId: null,
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

    setCanvasTransform: (scale, offsetX, offsetY) => {
      set((state) => ({
        canvas: { 
          ...state.canvas, 
          scale: Math.max(0.1, Math.min(3, scale)),
          offsetX,
          offsetY,
        },
      }));
    },

    resetCanvas: () => {
      set({ canvas: initialCanvasState });
    },

    // WebSocket
    setWsConnected: (connected) => {
      set({ wsConnected: connected });
    },

    // Layout actions
    autoArrangeLayout: async () => {
      const state = get();
      const { nodes, connections, groups, groupConnections } = state;

      // Helper: Compute hierarchical levels using BFS
      const computeLevels = <T extends { id: string }>(
        items: T[],
        getIncomingIds: (item: T) => string[]
      ): Map<string, number> => {
        const levels = new Map<string, number>();
        const itemMap = new Map(items.map(item => [item.id, item]));
        
        // Find roots (items with no incoming connections from within the set)
        const hasIncoming = new Set<string>();
        for (const item of items) {
          const incomingIds = getIncomingIds(item);
          for (const id of incomingIds) {
            if (itemMap.has(id)) {
              hasIncoming.add(item.id);
            }
          }
        }
        
        const roots = items.filter(item => !hasIncoming.has(item.id));
        
        // BFS to assign levels
        const queue: { id: string; level: number }[] = roots.map(r => ({ id: r.id, level: 0 }));
        const visited = new Set<string>();
        
        while (queue.length > 0) {
          const { id, level } = queue.shift()!;
          if (visited.has(id)) {
            // Update level if we found a longer path
            levels.set(id, Math.max(levels.get(id) || 0, level));
            continue;
          }
          visited.add(id);
          levels.set(id, level);
          
          // Find items that have this item as a source
          for (const item of items) {
            const incomingIds = getIncomingIds(item);
            if (incomingIds.includes(id) && !visited.has(item.id)) {
              queue.push({ id: item.id, level: level + 1 });
            }
          }
        }
        
        // Handle disconnected items (no connections at all)
        for (const item of items) {
          if (!levels.has(item.id)) {
            levels.set(item.id, 0);
          }
        }
        
        return levels;
      };

      // Group items by their level
      const groupByLevel = <T extends { id: string }>(
        items: T[],
        levels: Map<string, number>
      ): T[][] => {
        const maxLevel = Math.max(...Array.from(levels.values()), 0);
        const result: T[][] = Array.from({ length: maxLevel + 1 }, () => []);
        
        for (const item of items) {
          const level = levels.get(item.id) || 0;
          result[level].push(item);
        }
        
        return result;
      };

      // Step 1: Compute levels for groups based on group connections
      const getGroupIncomingIds = (group: NodeGroup): string[] => {
        return groupConnections
          .filter(gc => gc.targetGroupId === group.id)
          .map(gc => gc.sourceGroupId);
      };
      
      const groupLevels = computeLevels(groups, getGroupIncomingIds);
      const groupsByLevel = groupByLevel(groups, groupLevels);

      // Step 2: Position groups and calculate their required sizes based on contained nodes
      const updatedGroups: { id: string; positionX: number; positionY: number; width: number; height: number }[] = [];
      const updatedNodes: { id: string; positionX: number; positionY: number }[] = [];

      let currentY = LAYOUT_CONFIG.startY;

      for (let level = 0; level < groupsByLevel.length; level++) {
        const levelGroups = groupsByLevel[level];
        if (levelGroups.length === 0) continue;

        let currentX = LAYOUT_CONFIG.startX;
        let maxGroupHeight = 0;

        for (const group of levelGroups) {
          // Get nodes in this group
          const groupNodes = nodes.filter(n => n.groupId === group.id);

          // Compute node levels within this group
          const getNodeIncomingIds = (node: NetworkNode): string[] => {
            return connections
              .filter(c => c.targetNodeId === node.id)
              .map(c => c.sourceNodeId);
          };

          const nodeLevels = computeLevels(groupNodes, getNodeIncomingIds);
          const nodesByLevel = groupByLevel(groupNodes, nodeLevels);

          // Calculate required group size based on nodes
          const maxNodesInRow = Math.max(...nodesByLevel.map(l => l.length), 1);
          const numNodeLevels = nodesByLevel.filter(l => l.length > 0).length || 1;

          const requiredWidth = Math.max(
            LAYOUT_CONFIG.minGroupWidth,
            maxNodesInRow * LAYOUT_CONFIG.nodeHorizontalSpacing + LAYOUT_CONFIG.groupPadding * 2
          );
          const requiredHeight = Math.max(
            LAYOUT_CONFIG.minGroupHeight,
            numNodeLevels * LAYOUT_CONFIG.nodeVerticalSpacing + LAYOUT_CONFIG.groupHeaderHeight + LAYOUT_CONFIG.groupPadding * 2
          );

          // Position nodes within the group
          let nodeY = currentY + LAYOUT_CONFIG.groupHeaderHeight + LAYOUT_CONFIG.groupPadding;

          for (const levelNodes of nodesByLevel) {
            if (levelNodes.length === 0) continue;

            const totalNodesWidth = levelNodes.length * LAYOUT_CONFIG.nodeHorizontalSpacing;
            let nodeX = currentX + (requiredWidth - totalNodesWidth) / 2 + LAYOUT_CONFIG.nodeHorizontalSpacing / 2;

            for (const node of levelNodes) {
              updatedNodes.push({
                id: node.id,
                positionX: nodeX,
                positionY: nodeY,
              });
              nodeX += LAYOUT_CONFIG.nodeHorizontalSpacing;
            }

            nodeY += LAYOUT_CONFIG.nodeVerticalSpacing;
          }

          updatedGroups.push({
            id: group.id,
            positionX: currentX,
            positionY: currentY,
            width: requiredWidth,
            height: requiredHeight,
          });

          currentX += requiredWidth + LAYOUT_CONFIG.groupHorizontalSpacing;
          maxGroupHeight = Math.max(maxGroupHeight, requiredHeight);
        }

        currentY += maxGroupHeight + LAYOUT_CONFIG.groupVerticalSpacing;
      }

      // Step 3: Handle ungrouped nodes - place them to the right of all groups
      const ungroupedNodes = nodes.filter(n => !n.groupId);
      
      if (ungroupedNodes.length > 0) {
        const getNodeIncomingIds = (node: NetworkNode): string[] => {
          return connections
            .filter(c => c.targetNodeId === node.id)
            .map(c => c.sourceNodeId);
        };

        const ungroupedLevels = computeLevels(ungroupedNodes, getNodeIncomingIds);
        const ungroupedByLevel = groupByLevel(ungroupedNodes, ungroupedLevels);

        // Find the rightmost position of all groups
        const maxGroupX = updatedGroups.length > 0
          ? Math.max(...updatedGroups.map(g => g.positionX + g.width))
          : LAYOUT_CONFIG.startX;

        let ungroupedStartX = maxGroupX + LAYOUT_CONFIG.groupHorizontalSpacing * 2;
        let ungroupedY = LAYOUT_CONFIG.startY;

        for (const levelNodes of ungroupedByLevel) {
          if (levelNodes.length === 0) continue;

          let nodeX = ungroupedStartX;

          for (const node of levelNodes) {
            updatedNodes.push({
              id: node.id,
              positionX: nodeX,
              positionY: ungroupedY,
            });
            nodeX += LAYOUT_CONFIG.nodeHorizontalSpacing;
          }

          ungroupedY += LAYOUT_CONFIG.nodeVerticalSpacing;
        }
      }

      // Step 4: Apply updates to state
      set((state) => ({
        nodes: state.nodes.map(node => {
          const update = updatedNodes.find(u => u.id === node.id);
          return update ? { ...node, positionX: update.positionX, positionY: update.positionY } : node;
        }),
        groups: state.groups.map(group => {
          const update = updatedGroups.find(u => u.id === group.id);
          return update 
            ? { ...group, positionX: update.positionX, positionY: update.positionY, width: update.width, height: update.height }
            : group;
        }),
      }));

      // Step 5: Persist to backend (fire all requests in parallel)
      const nodePromises = updatedNodes.map(node =>
        nodesApi.updatePosition(node.id, node.positionX, node.positionY).catch(console.error)
      );

      const groupPromises = updatedGroups.map(group =>
        groupsApi.updatePosition(group.id, {
          positionX: group.positionX,
          positionY: group.positionY,
          width: group.width,
          height: group.height,
        }).catch(console.error)
      );

      await Promise.all([...nodePromises, ...groupPromises]);
    },

    // Helpers
    getNodeById: (id) => {
      return get().nodes.find((node) => node.id === id);
    },

    getGroupById: (id) => {
      return get().groups.find((group) => group.id === id);
    },

    getNodesInGroup: (groupId) => {
      return get().nodes.filter((node) => node.groupId === groupId);
    },

    getConnectionsForNode: (nodeId) => {
      return get().connections.filter(
        (conn) => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
      );
    },

    getGroupConnectionsForGroup: (groupId) => {
      return get().groupConnections.filter(
        (conn) => conn.sourceGroupId === groupId || conn.targetGroupId === groupId
      );
    },
  }))
);

// ============== SELECTORS ==============
// Granular selectors to minimize re-renders

// Basic data selectors
export const selectNodes = (state: NetworkState) => state.nodes;
export const selectConnections = (state: NetworkState) => state.connections;
export const selectGroups = (state: NetworkState) => state.groups;
export const selectGroupConnections = (state: NetworkState) => state.groupConnections;

// Selection state selectors (separate from data to avoid re-renders)
export const selectSelectedNodeId = (state: NetworkState) => state.selectedNodeId;
export const selectSelectedGroupId = (state: NetworkState) => state.selectedGroupId;
export const selectConnectingFromId = (state: NetworkState) => state.connectingFromId;
export const selectConnectingFromGroupId = (state: NetworkState) => state.connectingFromGroupId;

// Selected entity selectors
export const selectSelectedNode = (state: NetworkState) => 
  state.selectedNodeId ? state.nodes.find(n => n.id === state.selectedNodeId) : null;
export const selectSelectedGroup = (state: NetworkState) =>
  state.selectedGroupId ? state.groups.find(g => g.id === state.selectedGroupId) : null;

// Editor state selectors
export const selectEditorMode = (state: NetworkState) => state.editorMode;
export const selectCanvasState = (state: NetworkState) => state.canvas;

// Canvas transform selectors (granular for viewport culling)
export const selectCanvasScale = (state: NetworkState) => state.canvas.scale;
export const selectCanvasOffset = (state: NetworkState) => ({ x: state.canvas.offsetX, y: state.canvas.offsetY });

// Connection state selectors
export const selectWsConnected = (state: NetworkState) => state.wsConnected;
export const selectIsLoading = (state: NetworkState) => state.isLoading;
export const selectError = (state: NetworkState) => state.error;

// Derived/computed selectors with stable references
export const selectNodeCount = (state: NetworkState) => state.nodes.length;
export const selectGroupCount = (state: NetworkState) => state.groups.length;
export const selectConnectionCount = (state: NetworkState) => state.connections.length;

// Status summary selector - used by StatusPanel
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

// Selector factory for getting a single node by ID (avoids re-renders from other nodes)
export const createSelectNodeById = (nodeId: string) => 
  (state: NetworkState) => state.nodes.find(n => n.id === nodeId);

// Selector factory for getting a single group by ID
export const createSelectGroupById = (groupId: string) =>
  (state: NetworkState) => state.groups.find(g => g.id === groupId);

// Selector for nodes in a specific group
export const createSelectNodesInGroup = (groupId: string) =>
  (state: NetworkState) => state.nodes.filter(n => n.groupId === groupId);

// Selector for connections involving a specific node
export const createSelectConnectionsForNode = (nodeId: string) =>
  (state: NetworkState) => state.connections.filter(
    c => c.sourceNodeId === nodeId || c.targetNodeId === nodeId
  );




