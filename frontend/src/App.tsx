import { useEffect, useState } from 'react';
import { useNetworkStore } from './store/networkStore';
import { useWebSocket } from './hooks/useWebSocket';
import { NetworkCanvas } from './components/NetworkCanvas/NetworkCanvas';
import { StatusPanel } from './components/StatusPanel/StatusPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { NodeEditor } from './components/NodeEditor/NodeEditor';
import { GroupEditor } from './components/GroupEditor/GroupEditor';
import { Login } from './components/Login';
import { SetupWizard } from './components/SetupWizard';
import { Settings } from './components/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LogOut, Loader2, Settings as SettingsIcon } from 'lucide-react';
import type { WSMessage, NodeStatusUpdatePayload, BatchStatusUpdatePayload, NodeGroup, GroupConnection } from './types/network';

// API base URL
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  return window.location.port === '8080' 
    ? 'http://localhost:4000'
    : '';
})();

function NetworkMonitor() {
  const { 
    fetchNetwork, 
    setWsConnected,
    addNode,
    updateNode,
    removeNode,
    addConnection,
    removeConnection,
    updateNodeStatus,
    batchUpdateNodeStatus,
    addGroup,
    updateGroup,
    removeGroup,
    assignNodeToGroup,
    addGroupConnection,
    removeGroupConnection,
    setActiveSource,
    selectedNodeId,
    selectedGroupId,
  } = useNetworkStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Handle WebSocket messages
  const handleWSMessage = (message: WSMessage) => {
    switch (message.type) {
      case 'NODE_STATUS_UPDATE':
        updateNodeStatus(message.payload as NodeStatusUpdatePayload);
        break;
      case 'BATCH_STATUS_UPDATE':
        // Handle batched status updates (much more efficient for monitoring cycles)
        batchUpdateNodeStatus((message.payload as BatchStatusUpdatePayload).updates);
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
      case 'CONNECTION_ACTIVE_SOURCE_CHANGED':
        const activeSourceChange = message.payload as { connectionId: string; targetNodeId: string; isActiveSource: boolean };
        setActiveSource(activeSourceChange.connectionId, activeSourceChange.targetNodeId);
        break;
      case 'GROUP_CREATED':
        addGroup(message.payload as NodeGroup);
        break;
      case 'GROUP_UPDATED':
        const groupUpdate = message.payload as NodeGroup;
        updateGroup(groupUpdate.id, groupUpdate);
        break;
      case 'GROUP_DELETED':
        const groupDelete = message.payload as { id: string };
        removeGroup(groupDelete.id);
        break;
      case 'GROUP_CONNECTION_CREATED':
        addGroupConnection(message.payload as GroupConnection);
        break;
      case 'GROUP_CONNECTION_DELETED':
        const groupConnDelete = message.payload as { id: string };
        removeGroupConnection(groupConnDelete.id);
        break;
      case 'NODE_GROUP_CHANGED':
        const groupChange = message.payload as { nodeId: string; groupId: string | null };
        assignNodeToGroup(groupChange.nodeId, groupChange.groupId);
        break;
      case 'PING':
        // Heartbeat, ignore
        break;
    }
  };

  const { logout } = useAuth();

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
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="font-display text-xl md:text-2xl font-bold text-neon-blue text-glow tracking-wider">
            STARLIGHT
          </h1>
          <span className="text-xs md:text-sm text-gray-500 font-body hidden sm:inline">Network Monitor</span>
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
          
          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-neon-blue 
                     border border-dark-500 hover:border-neon-blue/50 rounded transition-all duration-200"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          
          {/* Logout button */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-neon-pink 
                     border border-dark-500 hover:border-neon-pink/50 rounded transition-all duration-200"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
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

      {/* Group Editor (when a group is selected) */}
      {selectedGroupId && <GroupEditor />}

      {/* Settings Modal */}
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Scanline effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden scanline opacity-20" />
    </div>
  );
}

// Loading screen while checking auth or setup
function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-dark-900 grid-bg">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
        <p className="text-gray-400 font-body">{message}</p>
      </div>
    </div>
  );
}

// Setup status check states
type SetupState = 'checking' | 'required' | 'complete';

// Main app wrapper that handles setup check and auth state
function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [setupState, setSetupState] = useState<SetupState>('checking');

  // Check if setup is complete
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/setup/status`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setSetupState(data.data.isSetupComplete ? 'complete' : 'required');
      } else {
        // Assume setup is needed if we can't determine
        setSetupState('required');
      }
    } catch (error) {
      console.error('Failed to check setup status:', error);
      // If server is unreachable, wait and retry
      setTimeout(checkSetupStatus, 2000);
    }
  };

  // Handle setup completion
  const handleSetupComplete = () => {
    setSetupState('complete');
  };

  // Show loading while checking setup status
  if (setupState === 'checking') {
    return <LoadingScreen message="Checking system status..." />;
  }

  // Show setup wizard if setup is required
  if (setupState === 'required') {
    return <SetupWizard onSetupComplete={handleSetupComplete} />;
  }

  // Setup is complete, proceed with normal auth flow
  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <NetworkMonitor />;
}

// Root component with auth provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
