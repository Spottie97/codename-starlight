import { useEffect } from 'react';
import { useNetworkStore } from './store/networkStore';
import { useWebSocket } from './hooks/useWebSocket';
import { NetworkCanvas } from './components/NetworkCanvas/NetworkCanvas';
import { StatusPanel } from './components/StatusPanel/StatusPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { NodeEditor } from './components/NodeEditor/NodeEditor';
import type { WSMessage, NodeStatusUpdatePayload } from './types/network';

function App() {
  const { 
    fetchNetwork, 
    setWsConnected,
    addNode,
    updateNode,
    removeNode,
    addConnection,
    removeConnection,
    updateNodeStatus,
    selectedNodeId,
  } = useNetworkStore();

  // Handle WebSocket messages
  const handleWSMessage = (message: WSMessage) => {
    console.log('WS Message:', message.type, message.payload);
    
    switch (message.type) {
      case 'NODE_STATUS_UPDATE':
        updateNodeStatus(message.payload as NodeStatusUpdatePayload);
        break;
      case 'NODE_CREATED':
        addNode(message.payload as any);
        break;
      case 'NODE_UPDATED':
        const nodeUpdate = message.payload as any;
        updateNode(nodeUpdate.id, nodeUpdate);
        break;
      case 'NODE_DELETED':
        const nodeDelete = message.payload as { id: string };
        removeNode(nodeDelete.id);
        break;
      case 'CONNECTION_CREATED':
        addConnection(message.payload as any);
        break;
      case 'CONNECTION_DELETED':
        const connDelete = message.payload as { id: string };
        removeConnection(connDelete.id);
        break;
      case 'PING':
        // Heartbeat, ignore
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const { isConnected } = useWebSocket({
    onMessage: handleWSMessage,
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
  });

  // Fetch network on mount
  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-dark-900 grid-bg">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 h-14 glass-dark flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-neon-blue text-glow tracking-wider">
            STARLIGHT
          </h1>
          <span className="text-sm text-gray-500 font-body">Network Monitor</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            <div 
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-neon-green pulse-online' : 'bg-neon-pink pulse-offline'
              }`} 
            />
            <span className={isConnected ? 'text-neon-green' : 'text-neon-pink'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar />

      {/* Main Canvas */}
      <main className="absolute inset-0 pt-14">
        <NetworkCanvas />
      </main>

      {/* Status Panel */}
      <StatusPanel />

      {/* Node Editor (when a node is selected) */}
      {selectedNodeId && <NodeEditor />}

      {/* Scanline effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden scanline opacity-20" />
    </div>
  );
}

export default App;




