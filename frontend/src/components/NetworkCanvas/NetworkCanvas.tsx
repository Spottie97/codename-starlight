import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import { 
  Radio, 
  Router, 
  GitBranch, 
  Server, 
  Globe, 
  Wifi, 
  Shield, 
  Box,
  X,
  Cloud,
  Network
} from 'lucide-react';
import { useNetworkStore, selectNodes, selectConnections, selectGroups, selectGroupConnections, selectEditorMode, selectCanvasState } from '../../store/networkStore';
import { NetworkNode } from './NetworkNode';
import { ConnectionLine } from './ConnectionLine';
import { GroupConnectionLine } from './GroupConnectionLine';
import { GridBackground } from './GridBackground';
import { GroupZone } from './GroupZone';
import { nodesApi, connectionsApi, groupsApi, groupConnectionsApi } from '../../services/api';
import type { CreateNodeDTO, NetworkNode as INetworkNode, NodeType, NodeGroup, CreateGroupDTO } from '../../types/network';
import { NODE_TYPE_COLORS, DEFAULT_MONITORING_METHOD, NODE_TYPE_LABELS, GROUP_COLORS } from '../../types/network';
import { cn } from '../../lib/utils';

// Debounce helper for position saves
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Node type options for the selector
const NODE_TYPE_OPTIONS: { value: NodeType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'PROBE', label: 'Probe', icon: <Radio size={20} />, description: 'Physical monitoring device (ESP32, Arduino)' },
  { value: 'ROUTER', label: 'Router', icon: <Router size={20} />, description: 'Network router' },
  { value: 'SWITCH', label: 'Switch', icon: <GitBranch size={20} />, description: 'Network switch' },
  { value: 'SERVER', label: 'Server', icon: <Server size={20} />, description: 'Server or computer' },
  { value: 'GATEWAY', label: 'Gateway', icon: <Globe size={20} />, description: 'Internet gateway/modem' },
  { value: 'ACCESS_POINT', label: 'Access Point', icon: <Wifi size={20} />, description: 'Wireless access point' },
  { value: 'FIREWALL', label: 'Firewall', icon: <Shield size={20} />, description: 'Network firewall' },
  { value: 'INTERNET', label: 'Internet', icon: <Cloud size={20} />, description: 'WAN/ISP connection entry point' },
  { value: 'MAIN_LINK', label: 'Main Link', icon: <Network size={20} />, description: 'Main network entry point' },
  { value: 'VIRTUAL', label: 'Virtual', icon: <Box size={20} />, description: 'Visual grouping (no monitoring)' },
];

interface PendingNode {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

export function NetworkCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [pendingNode, setPendingNode] = useState<PendingNode | null>(null);
  
  const nodes = useNetworkStore(selectNodes);
  const connections = useNetworkStore(selectConnections);
  const groups = useNetworkStore(selectGroups);
  const groupConnections = useNetworkStore(selectGroupConnections);
  const editorMode = useNetworkStore(selectEditorMode);
  const canvas = useNetworkStore(selectCanvasState);
  
  const {
    setSelectedNode,
    setSelectedGroup,
    selectedGroupId,
    selectedNodeId,
    addNode,
    updateNodePosition,
    connectingFromId,
    startConnecting,
    cancelConnecting,
    addConnection,
    removeNode,
    removeConnection,
    addGroup,
    updateGroup,
    updateGroupPosition,
    removeGroup,
    assignNodeToGroup,
    // Group connection actions
    connectingFromGroupId,
    startConnectingGroups,
    cancelConnectingGroups,
    addGroupConnection,
    removeGroupConnection,
  } = useNetworkStore();

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Close pending node selector on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingNode(null);
        cancelConnecting();
        cancelConnectingGroups();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelConnecting, cancelConnectingGroups]);

  // Handle zoom with mouse wheel / trackpad
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Get current state directly for responsiveness (avoids stale closures)
    const state = useNetworkStore.getState();
    const { scale: oldScale, offsetX, offsetY } = state.canvas;
    
    // Calculate pointer position relative to canvas (before zoom)
    const mousePointTo = {
      x: (pointer.x - offsetX) / oldScale,
      y: (pointer.y - offsetY) / oldScale,
    };
    
    // Smooth zoom factor based on delta
    // Normalize delta for consistent behavior across devices
    const delta = -e.evt.deltaY;
    const zoomIntensity = 0.009;
    const scaleFactor = 1 + delta * zoomIntensity;
    
    const newScale = Math.max(0.1, Math.min(3, oldScale * scaleFactor));
    
    // Calculate new offset to keep the point under the mouse stationary
    const newOffsetX = pointer.x - mousePointTo.x * newScale;
    const newOffsetY = pointer.y - mousePointTo.y * newScale;
    
    // Single state update for better performance
    state.setCanvasTransform(newScale, newOffsetX, newOffsetY);
  }, []);

  // Handle canvas click for adding nodes/groups
  const handleStageClick = useCallback(async (e: any) => {
    // Only handle clicks on the stage itself (not on nodes)
    if (e.target !== e.currentTarget) return;

    if (editorMode === 'add') {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      
      // Adjust for canvas offset and scale
      const x = (pointer.x - canvas.offsetX) / canvas.scale;
      const y = (pointer.y - canvas.offsetY) / canvas.scale;

      // Show node type selector
      setPendingNode({
        x,
        y,
        screenX: pointer.x,
        screenY: pointer.y,
      });
    } else if (editorMode === 'group') {
      // Create a new group at click position
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      
      const x = (pointer.x - canvas.offsetX) / canvas.scale;
      const y = (pointer.y - canvas.offsetY) / canvas.scale;

      const newGroup: CreateGroupDTO = {
        name: `Group ${groups.length + 1}`,
        positionX: x,
        positionY: y,
        width: 300,
        height: 200,
        color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
        opacity: 0.15,
      };

      try {
        const response = await groupsApi.create(newGroup);
        if (response.success && response.data) {
          addGroup(response.data);
          setSelectedGroup(response.data.id);
        }
      } catch (error) {
        console.error('Failed to create group:', error);
      }
    } else if (editorMode === 'select') {
      setSelectedNode(null);
      setSelectedGroup(null);
    }

    // Cancel connecting if clicking on empty space
    if (connectingFromId) {
      cancelConnecting();
    }
    if (connectingFromGroupId) {
      cancelConnectingGroups();
    }
  }, [editorMode, canvas, setSelectedNode, setSelectedGroup, connectingFromId, cancelConnecting, connectingFromGroupId, cancelConnectingGroups, groups.length, addGroup]);

  // Create node with selected type
  const handleCreateNode = async (type: NodeType) => {
    if (!pendingNode) return;

    const newNode: CreateNodeDTO = {
      name: `${NODE_TYPE_LABELS[type]} ${nodes.filter(n => n.type === type).length + 1}`,
      type,
      positionX: pendingNode.x,
      positionY: pendingNode.y,
      color: NODE_TYPE_COLORS[type],
      monitoringMethod: DEFAULT_MONITORING_METHOD[type],
    };

    try {
      const response = await nodesApi.create(newNode);
      if (response.success && response.data) {
        addNode(response.data);
      }
    } catch (error) {
      console.error('Failed to create node:', error);
    }

    setPendingNode(null);
  };

  // Handle node click
  const handleNodeClick = useCallback(async (node: INetworkNode) => {
    if (editorMode === 'select') {
      setSelectedNode(node.id);
    } else if (editorMode === 'connect') {
      if (!connectingFromId) {
        startConnecting(node.id);
      } else if (connectingFromId !== node.id) {
        // Complete connection
        try {
          const response = await connectionsApi.create({
            sourceNodeId: connectingFromId,
            targetNodeId: node.id,
          });
          if (response.success && response.data) {
            addConnection(response.data);
          }
        } catch (error) {
          console.error('Failed to create connection:', error);
        }
        cancelConnecting();
      }
    } else if (editorMode === 'delete') {
      try {
        const response = await nodesApi.delete(node.id);
        if (response.success) {
          removeNode(node.id);
        }
      } catch (error) {
        console.error('Failed to delete node:', error);
      }
    }
  }, [editorMode, connectingFromId, setSelectedNode, startConnecting, addConnection, cancelConnecting, removeNode]);

  // Debounced API save for node positions (300ms delay)
  const debouncedSaveNodePosition = useMemo(
    () => debounce(async (nodeId: string, x: number, y: number) => {
      try {
        await nodesApi.updatePosition(nodeId, x, y);
      } catch (error) {
        console.error('Failed to save position:', error);
      }
    }, 300),
    []
  );

  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    updateNodePosition(nodeId, x, y);
    debouncedSaveNodePosition(nodeId, x, y);
  }, [updateNodePosition, debouncedSaveNodePosition]);

  // Handle connection click
  const handleConnectionClick = useCallback(async (connectionId: string) => {
    if (editorMode === 'delete') {
      try {
        const response = await connectionsApi.delete(connectionId);
        if (response.success) {
          removeConnection(connectionId);
        }
      } catch (error) {
        console.error('Failed to delete connection:', error);
      }
    }
  }, [editorMode, removeConnection]);

  // Handle group connection click
  const handleGroupConnectionClick = useCallback(async (connectionId: string) => {
    if (editorMode === 'delete') {
      try {
        const response = await groupConnectionsApi.delete(connectionId);
        if (response.success) {
          removeGroupConnection(connectionId);
        }
      } catch (error) {
        console.error('Failed to delete group connection:', error);
      }
    }
  }, [editorMode, removeGroupConnection]);

  // Handle group click
  const handleGroupClick = useCallback(async (group: NodeGroup) => {
    if (editorMode === 'select') {
      setSelectedGroup(group.id);
    } else if (editorMode === 'connectGroups') {
      if (!connectingFromGroupId) {
        startConnectingGroups(group.id);
      } else if (connectingFromGroupId !== group.id) {
        // Complete group connection
        try {
          const response = await groupConnectionsApi.create({
            sourceGroupId: connectingFromGroupId,
            targetGroupId: group.id,
          });
          if (response.success && response.data) {
            addGroupConnection(response.data);
          }
        } catch (error) {
          console.error('Failed to create group connection:', error);
        }
        cancelConnectingGroups();
      }
    } else if (editorMode === 'delete') {
      try {
        const response = await groupsApi.delete(group.id);
        if (response.success) {
          removeGroup(group.id);
        }
      } catch (error) {
        console.error('Failed to delete group:', error);
      }
    }
  }, [editorMode, setSelectedGroup, removeGroup, connectingFromGroupId, startConnectingGroups, cancelConnectingGroups, addGroupConnection]);

  // Handle group drag - also move all nodes in the group
  const handleGroupDrag = useCallback(async (groupId: string, x: number, y: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    // Calculate the delta movement
    const dx = x - group.positionX;
    const dy = y - group.positionY;
    
    // Update group position
    updateGroupPosition(groupId, x, y);
    
    // Move all nodes that belong to this group
    const nodesInGroup = nodes.filter(n => n.groupId === groupId);
    for (const node of nodesInGroup) {
      const newNodeX = node.positionX + dx;
      const newNodeY = node.positionY + dy;
      updateNodePosition(node.id, newNodeX, newNodeY);
      // Save node position (fire and forget for performance)
      nodesApi.updatePosition(node.id, newNodeX, newNodeY).catch(console.error);
    }
    
    try {
      await groupsApi.updatePosition(groupId, { positionX: x, positionY: y });
    } catch (error) {
      console.error('Failed to save group position:', error);
    }
  }, [updateGroupPosition, updateNodePosition, groups, nodes]);

  // Handle group resize
  const handleGroupResize = useCallback(async (groupId: string, width: number, height: number) => {
    updateGroupPosition(groupId, 
      groups.find(g => g.id === groupId)?.positionX || 0,
      groups.find(g => g.id === groupId)?.positionY || 0,
      width,
      height
    );
    
    try {
      await groupsApi.updatePosition(groupId, { width, height });
    } catch (error) {
      console.error('Failed to save group size:', error);
    }
  }, [updateGroupPosition, groups]);

  // Check if a node is inside a group's bounds
  const findGroupAtPosition = useCallback((x: number, y: number): NodeGroup | null => {
    const HEADER_HEIGHT = 28;
    // Check groups in reverse order (topmost first based on zIndex)
    const sortedGroups = [...groups].sort((a, b) => b.zIndex - a.zIndex);
    
    for (const group of sortedGroups) {
      // Node center (x, y) should be inside the group's content area (below header)
      const isInsideX = x >= group.positionX && x <= group.positionX + group.width;
      const isInsideY = y >= group.positionY + HEADER_HEIGHT && y <= group.positionY + group.height;
      
      if (isInsideX && isInsideY) {
        return group;
      }
    }
    return null;
  }, [groups]);

  // Debounced group assignment check
  const debouncedGroupAssignment = useMemo(
    () => debounce(async (nodeId: string, nodeName: string, newGroupId: string | null, currentGroupId: string | null) => {
      if (newGroupId !== currentGroupId) {
        try {
          if (newGroupId) {
            await groupsApi.assignNode(newGroupId, nodeId);
          } else if (currentGroupId) {
            await groupsApi.unassignNode(currentGroupId, nodeId);
          }
        } catch (error) {
          console.error('Failed to update group assignment:', error);
        }
      }
    }, 500),
    []
  );

  // Handle node drag with group assignment
  const handleNodeDragWithGroup = useCallback((node: INetworkNode, x: number, y: number) => {
    updateNodePosition(node.id, x, y);
    
    // Check if node is now inside a group
    const targetGroup = findGroupAtPosition(x, y);
    const newGroupId = targetGroup?.id || null;
    
    // Get current groupId from the store (node param might be stale)
    const currentNode = nodes.find(n => n.id === node.id);
    const currentGroupId = currentNode?.groupId || null;
    
    // If group assignment changed, update it locally immediately
    if (newGroupId !== currentGroupId) {
      assignNodeToGroup(node.id, newGroupId);
    }
    
    // Debounced API calls
    debouncedGroupAssignment(node.id, node.name, newGroupId, currentGroupId);
    debouncedSaveNodePosition(node.id, x, y);
  }, [updateNodePosition, findGroupAtPosition, assignNodeToGroup, nodes, debouncedGroupAssignment, debouncedSaveNodePosition]);

  // Get cursor based on mode
  const getCursor = () => {
    switch (editorMode) {
      case 'add': return 'crosshair';
      case 'group': return 'crosshair';
      case 'connect': return connectingFromId ? 'pointer' : 'cell';
      case 'connectGroups': return connectingFromGroupId ? 'pointer' : 'cell';
      case 'delete': return 'not-allowed';
      default: return 'default';
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-hidden"
      style={{ cursor: getCursor() }}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleStageClick}
        onWheel={handleWheel}
        scaleX={canvas.scale}
        scaleY={canvas.scale}
        x={canvas.offsetX}
        y={canvas.offsetY}
        draggable={editorMode === 'select'}
        onDragEnd={(e) => {
          // Only update canvas offset if it was actually the Stage that was dragged
          // (not a node or group whose event bubbled up)
          const stage = e.target.getStage();
          if (e.target === stage) {
            useNetworkStore.getState().setCanvasOffset(stage.x(), stage.y());
          }
        }}
      >
        {/* Layer 1: Background (non-interactive, optimized) */}
        <Layer listening={false}>
          {/* Grid background - virtualized to only render visible lines */}
          <GridBackground 
            width={dimensions.width} 
            height={dimensions.height}
            canvasScale={canvas.scale}
            canvasOffsetX={canvas.offsetX}
            canvasOffsetY={canvas.offsetY}
          />
        </Layer>

        {/* Layer 2: All interactive elements (consolidated for performance) */}
        {/* Rendering order: Groups -> Group Connections -> Node Connections -> Nodes */}
        <Layer>
          {/* Groups (rendered first, appear behind everything) */}
          {groups
            .slice()
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((group) => (
              <GroupZone
                key={group.id}
                group={group}
                isSelected={selectedGroupId === group.id}
                isConnecting={connectingFromGroupId === group.id}
                onClick={() => handleGroupClick(group)}
                onDragEnd={(x, y) => handleGroupDrag(group.id, x, y)}
                onResize={(w, h) => handleGroupResize(group.id, w, h)}
                editorMode={editorMode}
              />
            ))}

          {/* Group Connections */}
          {groupConnections.map((connection) => {
            const sourceGroup = groups.find(g => g.id === connection.sourceGroupId);
            const targetGroup = groups.find(g => g.id === connection.targetGroupId);
            
            if (!sourceGroup || !targetGroup) return null;

            return (
              <GroupConnectionLine
                key={connection.id}
                connection={connection}
                sourceGroup={sourceGroup}
                targetGroup={targetGroup}
                nodes={nodes}
                onClick={() => handleGroupConnectionClick(connection.id)}
                isDeleteMode={editorMode === 'delete'}
              />
            );
          })}

          {/* Node Connections */}
          {connections.map((connection) => {
            const sourceNode = nodes.find(n => n.id === connection.sourceNodeId);
            const targetNode = nodes.find(n => n.id === connection.targetNodeId);
            
            if (!sourceNode || !targetNode) return null;

            return (
              <ConnectionLine
                key={connection.id}
                connection={connection}
                sourceNode={sourceNode}
                targetNode={targetNode}
                onClick={() => handleConnectionClick(connection.id)}
                isDeleteMode={editorMode === 'delete'}
              />
            );
          })}

          {/* Nodes (rendered last, appear on top) */}
          {nodes.map((node) => (
            <NetworkNode
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnecting={connectingFromId === node.id}
              onClick={() => handleNodeClick(node)}
              onDragEnd={(x, y) => handleNodeDragWithGroup(node, x, y)}
              editorMode={editorMode}
            />
          ))}
        </Layer>
      </Stage>

      {/* Node Type Selector Popup */}
      {pendingNode && (
        <div 
          className="absolute z-50"
          style={{
            left: Math.min(pendingNode.screenX, dimensions.width - 320),
            top: Math.min(pendingNode.screenY, dimensions.height - 400),
          }}
        >
          <div className="glass-dark rounded-xl overflow-hidden w-[300px] shadow-2xl border border-dark-500">
            <div className="flex items-center justify-between px-3 py-2 border-b border-dark-500">
              <span className="text-sm font-semibold text-neon-blue">Select Node Type</span>
              <button
                onClick={() => setPendingNode(null)}
                className="p-1 text-gray-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2 grid grid-cols-2 gap-1.5 max-h-[320px] overflow-y-auto">
              {NODE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleCreateNode(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all',
                    'hover:bg-dark-600 hover:scale-[1.02]',
                    'text-gray-300 hover:text-white',
                    'border border-transparent hover:border-dark-400'
                  )}
                >
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${NODE_TYPE_COLORS[option.value]}20` }}
                  >
                    <span style={{ color: NODE_TYPE_COLORS[option.value] }}>
                      {option.icon}
                    </span>
                  </div>
                  <span className="text-xs font-semibold">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Connecting indicator */}
      {connectingFromId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 glass-dark px-4 py-2 rounded-lg text-sm">
          <span className="text-neon-blue">Click another node to connect</span>
          <span className="text-gray-500 ml-2">or press ESC to cancel</span>
        </div>
      )}

      {/* Group Connecting indicator */}
      {connectingFromGroupId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 glass-dark px-4 py-2 rounded-lg text-sm">
          <span className="text-neon-purple">Click another group to connect</span>
          <span className="text-gray-500 ml-2">or press ESC to cancel</span>
        </div>
      )}
    </div>
  );
}
