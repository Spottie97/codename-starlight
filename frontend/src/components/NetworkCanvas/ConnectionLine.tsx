import { memo, useMemo } from 'react';
import { Group, Line, Circle, Text, Rect } from 'react-konva';
import type { Connection, NetworkNode } from '../../types/network';
import { STATUS_COLORS } from '../../types/network';
import { useGlobalAnimation, usePerformanceSettings } from '../../hooks/useGlobalAnimation';

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
  if (prevProps.isDeleteMode !== nextProps.isDeleteMode) return false;
  
  const prevConn = prevProps.connection;
  const nextConn = nextProps.connection;
  if (prevConn.id !== nextConn.id) return false;
  if (prevConn.animated !== nextConn.animated) return false;
  if (prevConn.color !== nextConn.color) return false;
  if (prevConn.bandwidth !== nextConn.bandwidth) return false;
  if (prevConn.isActiveSource !== nextConn.isActiveSource) return false;
  
  const prevSource = prevProps.sourceNode;
  const nextSource = nextProps.sourceNode;
  if (prevSource.positionX !== nextSource.positionX) return false;
  if (prevSource.positionY !== nextSource.positionY) return false;
  if (prevSource.status !== nextSource.status) return false;
  if (prevSource.internetStatus !== nextSource.internetStatus) return false;
  if (prevSource.type !== nextSource.type) return false;
  
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
  // Use global animation system instead of individual Konva.Animation
  const { animationMode } = usePerformanceSettings();
  const animationTime = useGlobalAnimation(20); // Lower FPS for particles
  
  const isInternetConnection = sourceNode.type === 'INTERNET';
  const isActiveSource = isInternetConnection && connection.isActiveSource;
  const isStandbySource = isInternetConnection && !connection.isActiveSource;

  const points = [
    sourceNode.positionX,
    sourceNode.positionY,
    targetNode.positionX,
    targetNode.positionY,
  ];

  // Memoize line color calculation
  const lineColor = useMemo(() => {
    if (isInternetConnection) {
      if (sourceNode.internetStatus === 'OFFLINE' || sourceNode.status === 'OFFLINE') {
        return STATUS_COLORS.OFFLINE;
      }
      if (isActiveSource) return ACTIVE_SOURCE_COLOR;
      return STANDBY_SOURCE_COLOR;
    }
    
    if (sourceNode.status === 'OFFLINE' || targetNode.status === 'OFFLINE') {
      return STATUS_COLORS.OFFLINE;
    }
    if (sourceNode.status === 'DEGRADED' || targetNode.status === 'DEGRADED') {
      return STATUS_COLORS.DEGRADED;
    }
    return connection.color;
  }, [isInternetConnection, isActiveSource, sourceNode.status, sourceNode.internetStatus, targetNode.status, connection.color]);

  const isActive = isInternetConnection 
    ? (sourceNode.internetStatus === 'ONLINE' || sourceNode.status === 'ONLINE')
    : (sourceNode.status === 'ONLINE' && targetNode.status === 'ONLINE');
  
  // Calculate particle positions using global animation time (no individual Konva.Animation)
  const shouldAnimateParticles = connection.animated && isActive && animationMode !== 'off';
  const period = isActiveSource ? 1200 : 2000;
  
  const particlePosition = useMemo(() => {
    if (!shouldAnimateParticles) return null;
    const t = (animationTime % period) / period;
    return {
      x: sourceNode.positionX + (targetNode.positionX - sourceNode.positionX) * t,
      y: sourceNode.positionY + (targetNode.positionY - sourceNode.positionY) * t,
    };
  }, [shouldAnimateParticles, animationTime, period, sourceNode.positionX, sourceNode.positionY, targetNode.positionX, targetNode.positionY]);

  const particle2Position = useMemo(() => {
    if (!shouldAnimateParticles || !isActiveSource) return null;
    const t2 = ((animationTime + period / 2) % period) / period;
    return {
      x: sourceNode.positionX + (targetNode.positionX - sourceNode.positionX) * t2,
      y: sourceNode.positionY + (targetNode.positionY - sourceNode.positionY) * t2,
    };
  }, [shouldAnimateParticles, isActiveSource, animationTime, period, sourceNode.positionX, sourceNode.positionY, targetNode.positionX, targetNode.positionY]);

  const midX = (sourceNode.positionX + targetNode.positionX) / 2;
  const midY = (sourceNode.positionY + targetNode.positionY) / 2;
  const strokeWidth = isDeleteMode ? 4 : isActiveSource ? 4 : 2;

  return (
    <Group
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => { document.body.style.cursor = isDeleteMode ? 'not-allowed' : 'pointer'; }}
      onMouseLeave={() => { document.body.style.cursor = 'default'; }}
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
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Main connection line */}
      <Line
        points={points}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        opacity={isActiveSource ? 1 : isStandbySource ? 0.5 : isActive ? 0.8 : 0.4}
        lineCap="round"
        lineJoin="round"
        dash={isStandbySource ? [15, 8] : isActive ? undefined : [10, 5]}
        shadowColor={lineColor}
        shadowBlur={isActiveSource ? 20 : isActive ? 10 : 0}
        shadowOpacity={isActiveSource ? 0.8 : 0.5}
        shadowForStrokeEnabled={false}
        hitStrokeWidth={20}
        perfectDrawEnabled={false}
      />

      {/* Animated particle - uses global animation system */}
      {particlePosition && (
        <Circle
          x={particlePosition.x}
          y={particlePosition.y}
          radius={isActiveSource ? 6 : 4}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={isActiveSource ? 20 : 15}
          shadowOpacity={1}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Second particle for active internet source */}
      {particle2Position && (
        <Circle
          x={particle2Position.x}
          y={particle2Position.y}
          radius={6}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={20}
          shadowOpacity={1}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Active/Standby indicator label */}
      {isInternetConnection && (
        <Group x={midX} y={midY - 18} listening={false}>
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
            perfectDrawEnabled={false}
          />
          <Text
            text={isActiveSource ? '● ACTIVE' : '○ STANDBY'}
            fontSize={10}
            fontFamily="Orbitron"
            fill={lineColor}
            width={70}
            align="center"
            offsetX={35}
            listening={false}
          />
        </Group>
      )}

      {/* Bandwidth label */}
      {connection.bandwidth && (
        <Group x={midX} y={midY + (isInternetConnection ? 8 : -12)} listening={false}>
          <Rect
            x={-30}
            y={-8}
            width={60}
            height={16}
            fill="#12121a"
            cornerRadius={4}
            opacity={0.9}
            perfectDrawEnabled={false}
          />
          <Text
            text={connection.bandwidth}
            fontSize={9}
            fontFamily="Orbitron"
            fill="#ffffff"
            width={60}
            align="center"
            offsetX={30}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}, areConnectionPropsEqual);
