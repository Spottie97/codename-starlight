import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Wifi, 
  WifiOff, 
  Globe, 
  Activity,
  Cloud,
  CloudOff,
  Zap,
  ZapOff,
  Check,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { useNetworkStore, selectStatusSummary, selectNodes, selectConnections } from '../../store/networkStore';
import { cn, formatRelativeTime, formatLatency, getStatusColorClass } from '../../lib/utils';
import { connectionsApi, networkApi } from '../../services/api';
import type { IspInfo } from '../../types/network';

export function StatusPanel() {
  const [isCollapsed, setIsCollapsed] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 1024
  );
  const [ispInfo, setIspInfo] = useState<IspInfo | null>(null);
  const [isLoadingIsp, setIsLoadingIsp] = useState(false);
  const [isDetectingIsp, setIsDetectingIsp] = useState(false);

  // Auto-collapse on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const summary = useNetworkStore(selectStatusSummary);
  const nodes = useNetworkStore(selectNodes);
  const connections = useNetworkStore(selectConnections);
  const setActiveSource = useNetworkStore((s) => s.setActiveSource);

  const probes = nodes.filter(n => n.type === 'PROBE');
  
  // Get all INTERNET type nodes
  const internetNodes = nodes.filter(n => n.type === 'INTERNET');
  
  // Get connections from INTERNET nodes (potential internet sources)
  const internetConnections = connections.filter(conn => {
    const sourceNode = nodes.find(n => n.id === conn.sourceNodeId);
    return sourceNode?.type === 'INTERNET';
  });

  // Fetch current ISP info on mount
  useEffect(() => {
    const fetchIspInfo = async () => {
      setIsLoadingIsp(true);
      try {
        const result = await networkApi.getCurrentIsp();
        if (result.success && result.data) {
          setIspInfo(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch ISP info:', error);
      } finally {
        setIsLoadingIsp(false);
      }
    };
    
    fetchIspInfo();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchIspInfo, 120000);
    return () => clearInterval(interval);
  }, []);

  // Handle toggling active source
  const handleSetActiveSource = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;
    
    try {
      const result = await connectionsApi.setActiveSource(connectionId);
      if (result.success) {
        setActiveSource(connectionId, connection.targetNodeId);
      }
    } catch (error) {
      console.error('Failed to set active source:', error);
    }
  };

  // Handle manual ISP detection
  const handleDetectIsp = async () => {
    setIsDetectingIsp(true);
    try {
      const result = await networkApi.detectIsp();
      if (result.success && result.data) {
        const data = result.data;
        setIspInfo({
          ...data.ispInfo,
          matchedNodeId: data.matchedNodeId,
          matchedNodeName: nodes.find(n => n.id === data.matchedNodeId)?.name || null,
        });
        
        // If switched, update the store
        if (result.data.switched && result.data.matchedNodeId) {
          // Refresh connections to get updated isActiveSource
          // The WebSocket should handle this automatically
        }
      }
    } catch (error) {
      console.error('Failed to detect ISP:', error);
    } finally {
      setIsDetectingIsp(false);
    }
  };

  return (
    <div 
      className={cn(
        'absolute top-20 right-0 z-40 h-[calc(100vh-6rem)] transition-all duration-300',
        isCollapsed ? 'w-12' : 'w-80'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute left-0 top-4 -translate-x-full p-2 glass-dark rounded-l-lg text-gray-400 hover:text-white transition-colors"
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Panel content */}
      <div className={cn(
        'h-full glass-dark overflow-hidden flex flex-col',
        isCollapsed && 'opacity-0 pointer-events-none'
      )}>
        {/* Header */}
        <div className="panel-header flex items-center gap-2">
          <Activity className="text-neon-blue" size={18} />
          <span>Network Status</span>
        </div>

        {/* Summary cards */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {/* Network Status */}
          <div className="glass p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Wifi size={14} className="text-neon-blue" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Network</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-display font-bold text-neon-green">
                {summary.online}
              </span>
              <span className="text-gray-500 text-sm">/ {summary.total}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.offline > 0 && (
                <span className="text-neon-pink">{summary.offline} offline</span>
              )}
            </div>
          </div>

          {/* Internet Status */}
          <div className="glass p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-neon-purple" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">Internet</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-display font-bold text-neon-green">
                {summary.internetOnline}
              </span>
              <span className="text-gray-500 text-sm">/ {summary.total}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.internetOffline > 0 && (
                <span className="text-neon-pink">{summary.internetOffline} offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Current ISP Section */}
        <div className="px-4 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Globe size={12} className="text-sky-400" />
              Current ISP
            </h3>
            <button
              onClick={handleDetectIsp}
              disabled={isDetectingIsp}
              className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Detect ISP"
            >
              <RefreshCw size={14} className={isDetectingIsp ? 'animate-spin' : ''} />
            </button>
          </div>
          
          {isLoadingIsp ? (
            <div className="text-sm text-gray-500">Detecting ISP...</div>
          ) : ispInfo ? (
            <div className="glass p-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white">{ispInfo.isp}</span>
                {ispInfo.matchedNodeName && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                    {ispInfo.matchedNodeName}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">IP:</span>
                  <span className="font-mono">{ispInfo.publicIp}</span>
                </div>
                {ispInfo.org && ispInfo.org !== ispInfo.isp && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Org:</span>
                    <span>{ispInfo.org}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <MapPin size={10} className="text-gray-500" />
                  <span>{ispInfo.city}, {ispInfo.region}, {ispInfo.country}</span>
                </div>
              </div>
              {!ispInfo.matchedNodeName && internetNodes.length > 0 && (
                <div className="mt-2 text-xs text-orange-400">
                  No matching INTERNET node. Configure ISP name in node settings.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Could not detect ISP
            </div>
          )}
        </div>

        {/* Internet Sources Section */}
        {internetNodes.length > 0 && (
          <div className="px-4 pb-4 pt-4 border-b border-white/10">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Cloud size={12} className="text-sky-400" />
              Internet Sources ({internetNodes.length})
            </h3>
            
            <div className="space-y-2">
              {internetNodes.map((node) => {
                const nodeConnections = internetConnections.filter(c => c.sourceNodeId === node.id);
                const isOnline = node.internetStatus === 'ONLINE' || node.status === 'ONLINE';
                
                return (
                  <div key={node.id} className="glass p-3 rounded-lg">
                    {/* Node header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <Cloud size={16} className="text-sky-400" />
                        ) : (
                          <CloudOff size={16} className="text-red-400" />
                        )}
                        <span className="font-semibold text-sm">{node.name}</span>
                      </div>
                      <span className={cn(
                        'text-xs font-mono px-2 py-0.5 rounded',
                        isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    
                    {/* Latency if available */}
                    {node.latency !== null && (
                      <div className="text-xs text-gray-400 mb-2">
                        Latency: <span className={cn(
                          node.latency < 50 ? 'text-green-400' : node.latency < 100 ? 'text-yellow-400' : 'text-red-400'
                        )}>{node.latency}ms</span>
                      </div>
                    )}
                    
                    {/* Connections from this internet source */}
                    {nodeConnections.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="text-xs text-gray-500 mb-1.5">Connected to:</div>
                        {nodeConnections.map(conn => {
                          const targetNode = nodes.find(n => n.id === conn.targetNodeId);
                          const isActive = conn.isActiveSource;
                          
                          return (
                            <button
                              key={conn.id}
                              onClick={() => handleSetActiveSource(conn.id)}
                              disabled={isActive}
                              className={cn(
                                'w-full flex items-center justify-between p-2 rounded text-sm transition-all',
                                isActive 
                                  ? 'bg-green-500/20 border border-green-500/50' 
                                  : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-orange-500/50'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {isActive ? (
                                  <Zap size={14} className="text-green-400" />
                                ) : (
                                  <ZapOff size={14} className="text-orange-400" />
                                )}
                                <span className={isActive ? 'text-green-400' : 'text-gray-400'}>
                                  {targetNode?.name || 'Unknown'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {isActive ? (
                                  <>
                                    <Check size={12} className="text-green-400" />
                                    <span className="text-xs text-green-400">ACTIVE</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-orange-400">Set Active</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
                    {nodeConnections.length === 0 && (
                      <div className="text-xs text-gray-500 italic">
                        Not connected to any nodes
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Probes list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Probes ({probes.length})
          </h3>
          
          <div className="space-y-2">
            {probes.map((probe) => (
              <ProbeStatusCard key={probe.id} probe={probe} />
            ))}

            {probes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <WifiOff className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">No probes configured</p>
                <p className="text-xs mt-1">Add nodes to start monitoring</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProbeStatusCardProps {
  probe: {
    id: string;
    name: string;
    status: string;
    internetStatus: string;
    latency: number | null;
    lastSeen: string | null;
  };
}

function ProbeStatusCard({ probe }: ProbeStatusCardProps) {
  const setSelectedNode = useNetworkStore((s) => s.setSelectedNode);

  return (
    <button
      onClick={() => setSelectedNode(probe.id)}
      className="w-full glass p-3 rounded-lg text-left hover:border-neon-blue/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div 
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                probe.status === 'ONLINE' && 'bg-neon-green pulse-online',
                probe.status === 'OFFLINE' && 'bg-neon-pink pulse-offline',
                probe.status === 'DEGRADED' && 'bg-neon-yellow pulse-degraded',
                probe.status === 'UNKNOWN' && 'bg-gray-500'
              )}
            />
            <span className="font-semibold truncate">{probe.name}</span>
          </div>
          
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            {/* Latency */}
            <span className="flex items-center gap-1">
              <Activity size={10} />
              {formatLatency(probe.latency)}
            </span>
            
            {/* Internet status */}
            <span className={cn(
              'flex items-center gap-1',
              getStatusColorClass(probe.internetStatus)
            )}>
              <Globe size={10} />
              {probe.internetStatus === 'ONLINE' ? 'WAN' : 'No WAN'}
            </span>
          </div>
        </div>

        {/* Last seen */}
        <div className="text-right text-xs text-gray-500">
          {formatRelativeTime(probe.lastSeen)}
        </div>
      </div>
    </button>
  );
}





