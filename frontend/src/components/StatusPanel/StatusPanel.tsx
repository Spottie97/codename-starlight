import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Wifi, 
  WifiOff, 
  Globe, 
  AlertTriangle,
  Activity
} from 'lucide-react';
import { useNetworkStore, selectStatusSummary, selectNodes } from '../../store/networkStore';
import { cn, formatRelativeTime, formatLatency, getStatusColorClass } from '../../lib/utils';

export function StatusPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const summary = useNetworkStore(selectStatusSummary);
  const nodes = useNetworkStore(selectNodes);

  const probes = nodes.filter(n => n.type === 'PROBE');

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

        {/* Probes list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
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




