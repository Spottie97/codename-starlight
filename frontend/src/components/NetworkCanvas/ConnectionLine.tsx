import React, { useRef, useEffect, memo } from 'react';
import { Group, Line, Circle, Text, Rect } from 'react-konva';
import Konva from 'konva';
import type { Connection, NetworkNode } from '../../types/network';
import { STATUS_COLORS } from '../../types/network';

// Colors for internet connections
const ACTIVE_SOURCE_COLOR = '#39ff14';  // Bright green for active
const STANDBY_SOURCE_COLOR = '#ff6b35'; // Orange for standby

interface ConnectionLineProps {
  connection: Connection;
  sourceNode: NetworkNode;
  targetNode: NetworkNode;
  onClick: () => void;
  isDeleteMode: boolean;
}

// Custom comparison function for memoization
function areConnectionPropsEqual(prevProps: ConnectionLineProps, nextProps: ConnectionLineProps): boolean {
  // Check primitive props
  if (prevProps.isDeleteMode !== nextProps.isDeleteMode) return false;
  
  // Check connection data
  const prevConn = prevProps.connection;
  const nextConn = nextProps.connection;
  if (prevConn.id !== nextConn.id) return false;
  if (prevConn.animated !== nextConn.animated) return false;
  if (prevConn.color !== nextConn.color) return false;
  if (prevConn.bandwidth !== nextConn.bandwidth) return false;
  if (prevConn.isActiveSource !== nextConn.isActiveSource) return false;
  
  // Check source node position and status (what affects rendering)
  const prevSource = prevProps.sourceNode;
  const nextSource = nextProps.sourceNode;
  if (prevSource.positionX !== nextSource.positionX) return false;
  if (prevSource.positionY !== nextSource.positionY) return false;
  if (prevSource.status !== nextSource.status) return false;
  if (prevSource.internetStatus !== nextSource.internetStatus) return false;
  if (prevSource.type !== nextSource.type) return false;
  
  // Check target node position and status
  const prevTarget = prevProps.targetNode;
  const nextTarget = nextProps.targetNode;
  if (prevTarget.positionX !== nextTarget.positionX) return false;
  if (prevTarget.positionY !== nextTarget.positionY) return false;
  if (prevTarget.status !== nextTarget.status) return false;
  if (prevTarget.internetStatus !== nextTarget.internetStatus) return false;
  
  return true;
}

export const ConnectionLine = memo(function ConnectionLine({
  connection,
  sourceNode,
  targetNode,
  onClick,
  isDeleteMode,
}: ConnectionLineProps) {
  const lineRef = useRef<Konva.Line>(null);
  const particleRef = useRef<Konva.Circle>(null);
  const particle2Ref = useRef<Konva.Circle>(null);

  // Check if this is an internet source connection
  const isInternetConnection = sourceNode.type === 'INTERNET';
  const isActiveSource = isInternetConnection && connection.isActiveSource;
  const isStandbySource = isInternetConnection && !connection.isActiveSource;

  // Calculate line points
  const points = [
    sourceNode.positionX,
    sourceNode.positionY,
    targetNode.positionX,
    targetNode.positionY,
  ];

  // Determine line color based on node statuses and active source state
  const getLineColor = () => {
    // For internet connections, use special colors
    if (isInternetConnection) {
      if (sourceNode.internetStatus === 'OFFLINE' || sourceNode.status === 'OFFLINE') {
        return STATUS_COLORS.OFFLINE;
      }
      if (isActiveSource) {
        return ACTIVE_SOURCE_COLOR;
      }
      return STANDBY_SOURCE_COLOR;
    }
    
    // Regular connection coloring
    if (sourceNode.status === 'OFFLINE' || targetNode.status === 'OFFLINE') {
      return STATUS_COLORS.OFFLINE;
    }
    if (sourceNode.status === 'DEGRADED' || targetNode.status === 'DEGRADED') {
      return STATUS_COLORS.DEGRADED;
    }
    return connection.color;
  };

  // Animate particles along the line
  useEffect(() => {
    if (!particleRef.current || !connection.animated) return;
    
    // For internet connections, check internet status
    if (isInternetConnection) {
      if (sourceNode.internetStatus === 'OFFLINE' || sourceNode.status === 'OFFLINE') return;
    } else {
      if (sourceNode.status === 'OFFLINE' || targetNode.status === 'OFFLINE') return;
    }

    // Faster animation for active internet source
    const period = isActiveSource ? 1200 : 2000;

    const anim = new Konva.Animation((frame) => {
      if (!frame || !particleRef.current) return;

      const t = (frame.time % period) / period;

      // Linear interpolation along the line
      const x = sourceNode.positionX + (targetNode.positionX - sourceNode.positionX) * t;
      const y = sourceNode.positionY + (targetNode.positionY - sourceNode.positionY) * t;

      particleRef.current.x(x);
      particleRef.current.y(y);

      // Second particle for active source (offset by 50%)
      if (particle2Ref.current && isActiveSource) {
        const t2 = ((frame.time + period / 2) % period) / period;
        const x2 = sourceNode.positionX + (targetNode.positionX - sourceNode.positionX) * t2;
        const y2 = sourceNode.positionY + (targetNode.positionY - sourceNode.positionY) * t2;
        particle2Ref.current.x(x2);
        particle2Ref.current.y(y2);
      }
    }, particleRef.current.getLayer());

    anim.start();
    return () => {
      anim.stop();
    };
  }, [sourceNode, targetNode, connection.animated, isActiveSource, isInternetConnection]);

  const lineColor = getLineColor();
  
  // Determine if connection is "active" (data flowing)
  const isConnectionActive = isInternetConnection 
    ? (sourceNode.internetStatus === 'ONLINE' || sourceNode.status === 'ONLINE')
    : (sourceNode.status === 'ONLINE' && targetNode.status === 'ONLINE');
  
  // For rendering purposes
  const isActive = isConnectionActive;
  
  // Calculate midpoint for labels
  const midX = (sourceNode.positionX + targetNode.positionX) / 2;
  const midY = (sourceNode.positionY + targetNode.positionY) / 2;

  // Determine stroke width based on connection type
  const getStrokeWidth = () => {
    if (isDeleteMode) return 4;
    if (isActiveSource) return 4;  // Thicker for active internet source
    if (isStandbySource) return 2;
    return 2;
  };

  return (
    <Group
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => {
        document.body.style.cursor = isDeleteMode ? 'not-allowed' : 'pointer';
      }}
      onMouseLeave={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Glow effect for active internet source */}
      {isActiveSource && isActive && (
        <Line
          points={points}
          stroke={lineColor}
          strokeWidth={12}
          opacity={0.2}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* Main connection line */}
      <Line
        ref={lineRef}
        points={points}
        stroke={lineColor}
        strokeWidth={getStrokeWidth()}
        opacity={isActiveSource ? 1 : isStandbySource ? 0.5 : isActive ? 0.8 : 0.4}
        lineCap="round"
        lineJoin="round"
        dash={isStandbySource ? [15, 8] : isActive ? undefined : [10, 5]}
        shadowColor={lineColor}
        shadowBlur={isActiveSource ? 20 : isActive ? 10 : 0}
        shadowOpacity={isActiveSource ? 0.8 : 0.5}
        hitStrokeWidth={20}
      />

      {/* Animated particle (data flow indicator) */}
      {connection.animated && isActive && (
        <Circle
          ref={particleRef}
          radius={isActiveSource ? 6 : 4}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={isActiveSource ? 20 : 15}
          shadowOpacity={1}
        />
      )}

      {/* Second particle for active internet source */}
      {connection.animated && isActiveSource && isActive && (
        <Circle
          ref={particle2Ref}
          radius={6}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={20}
          shadowOpacity={1}
        />
      )}

      {/* Active/Standby indicator label for internet connections */}
      {isInternetConnection && (
        <Group x={midX} y={midY - 18}>
          <Rect
            x={-35}
            y={-10}
            width={70}
            height={20}
            fill="#12121a"
            cornerRadius={4}
            opacity={0.95}
            stroke={lineColor}
            strokeWidth={1}
          />
          <Text
            text={isActiveSource ? '● ACTIVE' : '○ STANDBY'}
            fontSize={10}
            fontFamily="Orbitron"
            fill={lineColor}
            width={70}
            align="center"
            offsetX={35}
          />
        </Group>
      )}

      {/* Midpoint label (bandwidth if set) */}
      {connection.bandwidth && (
        <Group x={midX} y={midY + (isInternetConnection ? 8 : -12)}>
          <Rect
            x={-30}
            y={-8}
            width={60}
            height={16}
            fill="#12121a"
            cornerRadius={4}
            opacity={0.9}
          />
          <Text
            text={connection.bandwidth}
            fontSize={9}
            fontFamily="Orbitron"
            fill="#ffffff"
            width={60}
            align="center"
            offsetX={30}
          />
        </Group>
      )}
    </Group>
  );
}, areConnectionPropsEqual);

