import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import { useNetworkStore, selectNodes, selectConnections, selectEditorMode, selectCanvasState } from '../../store/networkStore';
import { NetworkNode } from './NetworkNode';
import { ConnectionLine } from './ConnectionLine';
import { GridBackground } from './GridBackground';
import { nodesApi, connectionsApi } from '../../services/api';
import type { CreateNodeDTO, NetworkNode as INetworkNode } from '../../types/network';

export function NetworkCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
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

      const newNode: CreateNodeDTO = {
        name: `Probe ${nodes.length + 1}`,
        type: 'PROBE',
        positionX: x,
        positionY: y,
        color: '#05d9e8',
      };

      try {
        const response = await nodesApi.create(newNode);
        if (response.success && response.data) {
          addNode(response.data);
        }
      } catch (error) {
        console.error('Failed to create node:', error);
      }
    } else if (editorMode === 'select') {
      setSelectedNode(null);
    }

    // Cancel connecting if clicking on empty space
    if (connectingFromId) {
      cancelConnecting();
    }
  }, [editorMode, canvas, nodes.length, addNode, setSelectedNode, connectingFromId, cancelConnecting]);

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




