import { useRef, useEffect, useState, useCallback } from 'react';
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
  X
} from 'lucide-react';
import { useNetworkStore, selectNodes, selectConnections, selectEditorMode, selectCanvasState } from '../../store/networkStore';
import { NetworkNode } from './NetworkNode';
import { ConnectionLine } from './ConnectionLine';
import { GridBackground } from './GridBackground';
import { nodesApi, connectionsApi } from '../../services/api';
import type { CreateNodeDTO, NetworkNode as INetworkNode, NodeType } from '../../types/network';
import { NODE_TYPE_COLORS, DEFAULT_MONITORING_METHOD, NODE_TYPE_LABELS } from '../../types/network';
import { cn } from '../../lib/utils';

// Node type options for the selector
const NODE_TYPE_OPTIONS: { value: NodeType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'PROBE', label: 'Probe', icon: <Radio size={20} />, description: 'Physical monitoring device (ESP32, Arduino)' },
  { value: 'ROUTER', label: 'Router', icon: <Router size={20} />, description: 'Network router' },
  { value: 'SWITCH', label: 'Switch', icon: <GitBranch size={20} />, description: 'Network switch' },
  { value: 'SERVER', label: 'Server', icon: <Server size={20} />, description: 'Server or computer' },
  { value: 'GATEWAY', label: 'Gateway', icon: <Globe size={20} />, description: 'Internet gateway/modem' },
  { value: 'ACCESS_POINT', label: 'Access Point', icon: <Wifi size={20} />, description: 'Wireless access point' },
  { value: 'FIREWALL', label: 'Firewall', icon: <Shield size={20} />, description: 'Network firewall' },
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
  const editorMode = useNetworkStore(selectEditorMode);
  const canvas = useNetworkStore(selectCanvasState);
  
  const {
    setSelectedNode,
    addNode,
    updateNodePosition,
    connectingFromId,
    startConnecting,
    cancelConnecting,
    addConnection,
    removeNode,
    removeConnection,
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelConnecting]);

  // Handle canvas click for adding nodes
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
    } else if (editorMode === 'select') {
      setSelectedNode(null);
    }

    // Cancel connecting if clicking on empty space
    if (connectingFromId) {
      cancelConnecting();
    }
  }, [editorMode, canvas, setSelectedNode, connectingFromId, cancelConnecting]);

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

  // Handle node drag
  const handleNodeDrag = useCallback(async (nodeId: string, x: number, y: number) => {
    updateNodePosition(nodeId, x, y);
    
    // Debounced save to API
    try {
      await nodesApi.updatePosition(nodeId, x, y);
    } catch (error) {
      console.error('Failed to save position:', error);
    }
  }, [updateNodePosition]);

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

  // Get cursor based on mode
  const getCursor = () => {
    switch (editorMode) {
      case 'add': return 'crosshair';
      case 'connect': return connectingFromId ? 'pointer' : 'cell';
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
        scaleX={canvas.scale}
        scaleY={canvas.scale}
        x={canvas.offsetX}
        y={canvas.offsetY}
        draggable={editorMode === 'select'}
        onDragEnd={(e) => {
          const stage = e.target;
          useNetworkStore.getState().setCanvasOffset(stage.x(), stage.y());
        }}
      >
        <Layer>
          {/* Grid background */}
          <GridBackground 
            width={dimensions.width * 3} 
            height={dimensions.height * 3} 
            offsetX={-dimensions.width}
            offsetY={-dimensions.height}
          />
        </Layer>

        <Layer>
          {/* Connections */}
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
        </Layer>

        <Layer>
          {/* Nodes */}
          {nodes.map((node) => (
            <NetworkNode
              key={node.id}
              node={node}
              isSelected={useNetworkStore.getState().selectedNodeId === node.id}
              isConnecting={connectingFromId === node.id}
              onClick={() => handleNodeClick(node)}
              onDragEnd={(x, y) => handleNodeDrag(node.id, x, y)}
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
    </div>
  );
}
