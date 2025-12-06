import { useMemo, memo } from 'react';
import { Group, Line, Circle, Text, Rect } from 'react-konva';
import type { GroupConnection, NodeGroup, NetworkNode } from '../../types/network';
import { useGlobalAnimation, usePerformanceSettings } from '../../hooks/useGlobalAnimation';

// Status colors for group connections
const STATUS_COLORS = {
  INTERNET: '#39ff14',
  LOCAL: '#ff6b35',
  OFFLINE: '#ff2a6d',
  UNKNOWN: '#6B7280',
};

type GroupStatus = 'INTERNET' | 'LOCAL' | 'OFFLINE' | 'UNKNOWN';

interface GroupConnectionLineProps {
  connection: GroupConnection;
  sourceGroup: NodeGroup;
  targetGroup: NodeGroup;
  nodes: NetworkNode[];
  onClick: () => void;
  isDeleteMode: boolean;
}

// Custom comparison function for memoization
function areGroupConnectionPropsEqual(prevProps: GroupConnectionLineProps, nextProps: GroupConnectionLineProps): boolean {
  if (prevProps.isDeleteMode !== nextProps.isDeleteMode) return false;
  
  const prevConn = prevProps.connection;
  const nextConn = nextProps.connection;
  if (prevConn.id !== nextConn.id) return false;
  if (prevConn.animated !== nextConn.animated) return false;
  if (prevConn.bandwidth !== nextConn.bandwidth) return false;
  if (prevConn.label !== nextConn.label) return false;
  
  const prevSource = prevProps.sourceGroup;
  const nextSource = nextProps.sourceGroup;
  if (prevSource.positionX !== nextSource.positionX) return false;
  if (prevSource.positionY !== nextSource.positionY) return false;
  if (prevSource.width !== nextSource.width) return false;
  if (prevSource.height !== nextSource.height) return false;
  
  const prevTarget = prevProps.targetGroup;
  const nextTarget = nextProps.targetGroup;
  if (prevTarget.positionX !== nextTarget.positionX) return false;
  if (prevTarget.positionY !== nextTarget.positionY) return false;
  if (prevTarget.width !== nextTarget.width) return false;
  if (prevTarget.height !== nextTarget.height) return false;
  
  // Check node statuses in source and target groups
  const prevSourceNodes = prevProps.nodes.filter(n => n.groupId === prevSource.id);
  const nextSourceNodes = nextProps.nodes.filter(n => n.groupId === nextSource.id);
  const prevTargetNodes = prevProps.nodes.filter(n => n.groupId === prevTarget.id);
  const nextTargetNodes = nextProps.nodes.filter(n => n.groupId === nextTarget.id);
  
  if (prevSourceNodes.length !== nextSourceNodes.length) return false;
  if (prevTargetNodes.length !== nextTargetNodes.length) return false;
  
  for (let i = 0; i < prevSourceNodes.length; i++) {
    const prev = prevSourceNodes[i];
    const next = nextSourceNodes.find(n => n.id === prev.id);
    if (!next) return false;
    if (prev.status !== next.status || prev.internetStatus !== next.internetStatus) return false;
  }
  
  for (let i = 0; i < prevTargetNodes.length; i++) {
    const prev = prevTargetNodes[i];
    const next = nextTargetNodes.find(n => n.id === prev.id);
    if (!next) return false;
    if (prev.status !== next.status || prev.internetStatus !== next.internetStatus) return false;
  }
  
  return true;
}

export const GroupConnectionLine = memo(function GroupConnectionLine({
  connection,
  sourceGroup,
  targetGroup,
  nodes,
  onClick,
  isDeleteMode,
}: GroupConnectionLineProps) {
  // Use global animation system instead of individual Konva.Animation
  const { animationMode } = usePerformanceSettings();
  const animationTime = useGlobalAnimation(20);

  const sourceNodes = useMemo(() => 
    nodes.filter(n => n.groupId === sourceGroup.id), 
    [nodes, sourceGroup.id]
  );
  const targetNodes = useMemo(() => 
    nodes.filter(n => n.groupId === targetGroup.id), 
    [nodes, targetGroup.id]
  );

  // Determine group status based on nodes
  const getGroupStatus = (groupNodes: NetworkNode[]): GroupStatus => {
    if (groupNodes.length === 0) return 'UNKNOWN';
    
    const hasInternet = groupNodes.some(n => 
      n.internetStatus === 'ONLINE' || 
      (n.type === 'INTERNET' && (n.status === 'ONLINE' || n.status === 'DEGRADED'))
    );
    if (hasInternet) return 'INTERNET';
    
    const hasLocal = groupNodes.some(n => n.status === 'ONLINE' || n.status === 'DEGRADED');
    if (hasLocal) return 'LOCAL';
    
    const allOffline = groupNodes.every(n => n.status === 'OFFLINE');
    if (allOffline) return 'OFFLINE';
    
    return 'UNKNOWN';
  };

  const sourceStatus = getGroupStatus(sourceNodes);
  const targetStatus = getGroupStatus(targetNodes);

  const connectionStatus = useMemo((): GroupStatus => {
    if (sourceStatus === 'OFFLINE' && targetStatus === 'OFFLINE') return 'OFFLINE';
    if (sourceStatus === 'INTERNET' || targetStatus === 'INTERNET') return 'INTERNET';
    if (sourceStatus === 'LOCAL' || targetStatus === 'LOCAL') return 'LOCAL';
    if (sourceStatus === 'OFFLINE' || targetStatus === 'OFFLINE') return 'OFFLINE';
    return 'UNKNOWN';
  }, [sourceStatus, targetStatus]);

  const lineColor = STATUS_COLORS[connectionStatus];
  const isActive = connectionStatus === 'INTERNET' || connectionStatus === 'LOCAL';
  const hasInternet = connectionStatus === 'INTERNET';

  // Calculate center points of groups
  const sourceX = sourceGroup.positionX + sourceGroup.width / 2;
  const sourceY = sourceGroup.positionY + sourceGroup.height / 2;
  const targetX = targetGroup.positionX + targetGroup.width / 2;
  const targetY = targetGroup.positionY + targetGroup.height / 2;
  const points = [sourceX, sourceY, targetX, targetY];

  // Calculate particle positions using global animation time
  const shouldAnimateParticles = (connection.animated || isActive) && 
    connectionStatus !== 'OFFLINE' && connectionStatus !== 'UNKNOWN' && animationMode !== 'off';
  const period = hasInternet ? 2000 : 3000;

  const particlePosition = useMemo(() => {
    if (!shouldAnimateParticles) return null;
    const t = (animationTime % period) / period;
    return {
      x: sourceX + (targetX - sourceX) * t,
      y: sourceY + (targetY - sourceY) * t,
    };
  }, [shouldAnimateParticles, animationTime, period, sourceX, sourceY, targetX, targetY]);

  const particle2Position = useMemo(() => {
    if (!shouldAnimateParticles || !hasInternet) return null;
    const t2 = ((animationTime + period / 2) % period) / period;
    return {
      x: sourceX + (targetX - sourceX) * t2,
      y: sourceY + (targetY - sourceY) * t2,
    };
  }, [shouldAnimateParticles, hasInternet, animationTime, period, sourceX, sourceY, targetX, targetY]);

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const statusLabel = connectionStatus === 'INTERNET' ? '● WAN' 
    : connectionStatus === 'LOCAL' ? '○ LAN' 
    : connectionStatus === 'OFFLINE' ? '✕ DOWN' : '? N/A';

  return (
    <Group
      onClick={(e) => { e.cancelBubble = true; onClick(); }}
      onTap={(e) => { e.cancelBubble = true; onClick(); }}
      onMouseEnter={() => { document.body.style.cursor = isDeleteMode ? 'not-allowed' : 'pointer'; }}
      onMouseLeave={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Glow effect */}
      {hasInternet && (
        <Line
          points={points}
          stroke={lineColor}
          strokeWidth={16}
          opacity={0.15}
          lineCap="round"
          lineJoin="round"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Main connection line */}
      <Line
        points={points}
        stroke={lineColor}
        strokeWidth={isDeleteMode ? 6 : hasInternet ? 5 : 4}
        opacity={hasInternet ? 0.9 : isActive ? 0.7 : 0.5}
        lineCap="round"
        lineJoin="round"
        dash={connectionStatus === 'OFFLINE' ? [8, 8] : connectionStatus === 'LOCAL' ? [15, 10] : undefined}
        shadowColor={lineColor}
        shadowBlur={hasInternet ? 25 : isActive ? 15 : 5}
        shadowOpacity={hasInternet ? 0.7 : 0.5}
        shadowForStrokeEnabled={false}
        hitStrokeWidth={25}
        perfectDrawEnabled={false}
      />

      {/* Animated particle - uses global animation */}
      {particlePosition && (
        <Circle
          x={particlePosition.x}
          y={particlePosition.y}
          radius={hasInternet ? 7 : 5}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={hasInternet ? 25 : 15}
          shadowOpacity={1}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Second particle */}
      {particle2Position && (
        <Circle
          x={particle2Position.x}
          y={particle2Position.y}
          radius={7}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={25}
          shadowOpacity={1}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Status indicator label */}
      <Group x={midX} y={midY - 20} listening={false}>
        <Rect
          x={-30}
          y={-10}
          width={60}
          height={20}
          fill="#12121a"
          cornerRadius={4}
          opacity={0.95}
          stroke={lineColor}
          strokeWidth={1}
          perfectDrawEnabled={false}
        />
        <Text
          text={statusLabel}
          fontSize={10}
          fontFamily="Orbitron"
          fill={lineColor}
          width={60}
          align="center"
          offsetX={30}
          listening={false}
        />
      </Group>

      {/* Connection label */}
      {(connection.bandwidth || connection.label) && (
        <Group x={midX} y={midY + 8} listening={false}>
          <Rect
            x={-40}
            y={-10}
            width={80}
            height={20}
            fill="#12121a"
            cornerRadius={4}
            opacity={0.9}
            perfectDrawEnabled={false}
          />
          <Text
            text={connection.label || connection.bandwidth || ''}
            fontSize={10}
            fontFamily="Orbitron"
            fill="#ffffff"
            width={80}
            align="center"
            offsetX={40}
            offsetY={-4}
            listening={false}
          />
        </Group>
      )}

      {/* Source indicator dot */}
      <Circle
        x={sourceX}
        y={sourceY}
        radius={8}
        fill={STATUS_COLORS[sourceStatus]}
        stroke={lineColor}
        strokeWidth={2}
        shadowColor={STATUS_COLORS[sourceStatus]}
        shadowBlur={hasInternet ? 15 : 10}
        shadowOpacity={0.7}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Target indicator dot */}
      <Circle
        x={targetX}
        y={targetY}
        radius={8}
        fill={STATUS_COLORS[targetStatus]}
        stroke={lineColor}
        strokeWidth={2}
        shadowColor={STATUS_COLORS[targetStatus]}
        shadowBlur={hasInternet ? 15 : 10}
        shadowOpacity={0.7}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}, areGroupConnectionPropsEqual);
