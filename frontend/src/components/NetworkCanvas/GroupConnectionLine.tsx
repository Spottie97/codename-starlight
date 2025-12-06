import { useRef, useEffect, useMemo } from 'react';
import { Group, Line, Circle, Text, Rect } from 'react-konva';
import Konva from 'konva';
import type { GroupConnection, NodeGroup, NetworkNode } from '../../types/network';

// Status colors for group connections
const STATUS_COLORS = {
  INTERNET: '#39ff14',    // Green - internet connectivity
  LOCAL: '#ff6b35',       // Orange - local only
  OFFLINE: '#ff2a6d',     // Red - all offline
  UNKNOWN: '#6B7280',     // Gray - unknown/no nodes
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

export function GroupConnectionLine({
  connection,
  sourceGroup,
  targetGroup,
  nodes,
  onClick,
  isDeleteMode,
}: GroupConnectionLineProps) {
  const lineRef = useRef<Konva.Line>(null);
  const particleRef = useRef<Konva.Circle>(null);
  const particle2Ref = useRef<Konva.Circle>(null);

  // Get nodes in each group
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
    
    // Check if any node has internet connectivity:
    // - INTERNET type node that is online
    // - Any node with internetStatus === 'ONLINE'
    const hasInternet = groupNodes.some(n => 
      n.internetStatus === 'ONLINE' || 
      (n.type === 'INTERNET' && (n.status === 'ONLINE' || n.status === 'DEGRADED'))
    );
    if (hasInternet) return 'INTERNET';
    
    // Check if any node is locally reachable (ONLINE or DEGRADED counts as reachable)
    const hasLocal = groupNodes.some(n => 
      n.status === 'ONLINE' || n.status === 'DEGRADED'
    );
    if (hasLocal) return 'LOCAL';
    
    // Check if ALL nodes are explicitly offline
    const allOffline = groupNodes.every(n => n.status === 'OFFLINE');
    if (allOffline) return 'OFFLINE';
    
    // Otherwise status is unknown (nodes exist but status not determined yet)
    return 'UNKNOWN';
  };

  const sourceStatus = getGroupStatus(sourceNodes);
  const targetStatus = getGroupStatus(targetNodes);

  // Combined connection status (based on the best status of both groups)
  const getConnectionStatus = (): GroupStatus => {
    // If both are offline, connection is offline
    if (sourceStatus === 'OFFLINE' && targetStatus === 'OFFLINE') return 'OFFLINE';
    
    // If either has internet, connection has internet access
    if (sourceStatus === 'INTERNET' || targetStatus === 'INTERNET') return 'INTERNET';
    
    // If either has local connectivity, connection is local
    if (sourceStatus === 'LOCAL' || targetStatus === 'LOCAL') return 'LOCAL';
    
    // If one is offline and one is unknown, show offline
    if (sourceStatus === 'OFFLINE' || targetStatus === 'OFFLINE') return 'OFFLINE';
    
    // Both are unknown
    return 'UNKNOWN';
  };

  const connectionStatus = getConnectionStatus();
  const lineColor = STATUS_COLORS[connectionStatus];
  const isActive = connectionStatus === 'INTERNET' || connectionStatus === 'LOCAL';
  const hasInternet = connectionStatus === 'INTERNET';

  // Calculate center points of groups
  const sourceX = sourceGroup.positionX + sourceGroup.width / 2;
  const sourceY = sourceGroup.positionY + sourceGroup.height / 2;
  const targetX = targetGroup.positionX + targetGroup.width / 2;
  const targetY = targetGroup.positionY + targetGroup.height / 2;

  // Calculate line points
  const points = [sourceX, sourceY, targetX, targetY];

  // Animate particles along the line
  useEffect(() => {
    if (!particleRef.current) return;
    if (!connection.animated && !isActive) return;
    if (connectionStatus === 'OFFLINE' || connectionStatus === 'UNKNOWN') return;

    // Faster animation for internet connections
    const period = hasInternet ? 2000 : 3000;

    const anim = new Konva.Animation((frame) => {
      if (!frame || !particleRef.current) return;

      const t = (frame.time % period) / period;

      // Linear interpolation along the line
      const x = sourceX + (targetX - sourceX) * t;
      const y = sourceY + (targetY - sourceY) * t;

      particleRef.current.x(x);
      particleRef.current.y(y);

      // Second particle for internet connections (offset by 50%)
      if (particle2Ref.current && hasInternet) {
        const t2 = ((frame.time + period / 2) % period) / period;
        const x2 = sourceX + (targetX - sourceX) * t2;
        const y2 = sourceY + (targetY - sourceY) * t2;
        particle2Ref.current.x(x2);
        particle2Ref.current.y(y2);
      }
    }, particleRef.current.getLayer());

    anim.start();
    return () => {
      anim.stop();
    };
  }, [sourceX, sourceY, targetX, targetY, connection.animated, isActive, hasInternet, connectionStatus]);

  // Calculate midpoint for label
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Status label text
  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'INTERNET': return '● WAN';
      case 'LOCAL': return '○ LAN';
      case 'OFFLINE': return '✕ DOWN';
      default: return '? N/A';
    }
  };

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onMouseEnter={() => {
        document.body.style.cursor = isDeleteMode ? 'not-allowed' : 'pointer';
      }}
      onMouseLeave={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Glow effect for internet connections */}
      {hasInternet && (
        <Line
          points={points}
          stroke={lineColor}
          strokeWidth={16}
          opacity={0.15}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* Main connection line - thicker than node connections */}
      <Line
        ref={lineRef}
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
        hitStrokeWidth={25}
      />

      {/* Animated particle (data flow indicator) */}
      {isActive && (
        <Circle
          ref={particleRef}
          radius={hasInternet ? 7 : 5}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={hasInternet ? 25 : 15}
          shadowOpacity={1}
        />
      )}

      {/* Second particle for internet connections */}
      {hasInternet && (
        <Circle
          ref={particle2Ref}
          radius={7}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={25}
          shadowOpacity={1}
        />
      )}

      {/* Status indicator label */}
      <Group x={midX} y={midY - 20}>
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
        />
        <Text
          text={getStatusLabel()}
          fontSize={10}
          fontFamily="Orbitron"
          fill={lineColor}
          width={60}
          align="center"
          offsetX={30}
        />
      </Group>

      {/* Connection label (bandwidth or custom label) */}
      {(connection.bandwidth || connection.label) && (
        <Group x={midX} y={midY + 8}>
          {/* Background */}
          <Rect
            x={-40}
            y={-10}
            width={80}
            height={20}
            fill="#12121a"
            cornerRadius={4}
            opacity={0.9}
          />
          {/* Label text */}
          <Text
            text={connection.label || connection.bandwidth || ''}
            fontSize={10}
            fontFamily="Orbitron"
            fill="#ffffff"
            width={80}
            align="center"
            offsetX={40}
            offsetY={-4}
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
      />
    </Group>
  );
}

