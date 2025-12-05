import { useRef, useEffect } from 'react';
import { Group, Line, Circle } from 'react-konva';
import Konva from 'konva';
import type { Connection, NetworkNode } from '../../types/network';
import { STATUS_COLORS } from '../../types/network';

interface ConnectionLineProps {
  connection: Connection;
  sourceNode: NetworkNode;
  targetNode: NetworkNode;
  onClick: () => void;
  isDeleteMode: boolean;
}

export function ConnectionLine({
  connection,
  sourceNode,
  targetNode,
  onClick,
  isDeleteMode,
}: ConnectionLineProps) {
  const lineRef = useRef<Konva.Line>(null);
  const particleRef = useRef<Konva.Circle>(null);

  // Calculate line points
  const points = [
    sourceNode.positionX,
    sourceNode.positionY,
    targetNode.positionX,
    targetNode.positionY,
  ];

  // Determine line color based on node statuses
  const getLineColor = () => {
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
    if (sourceNode.status === 'OFFLINE' || targetNode.status === 'OFFLINE') return;

    const anim = new Konva.Animation((frame) => {
      if (!frame || !particleRef.current) return;

      const period = 2000; // 2 seconds for a full loop
      const t = (frame.time % period) / period;

      // Linear interpolation along the line
      const x = sourceNode.positionX + (targetNode.positionX - sourceNode.positionX) * t;
      const y = sourceNode.positionY + (targetNode.positionY - sourceNode.positionY) * t;

      particleRef.current.x(x);
      particleRef.current.y(y);
    }, particleRef.current.getLayer());

    anim.start();
    return () => anim.stop();
  }, [sourceNode, targetNode, connection.animated]);

  const lineColor = getLineColor();
  const isActive = sourceNode.status === 'ONLINE' && targetNode.status === 'ONLINE';

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
      {/* Main connection line */}
      <Line
        ref={lineRef}
        points={points}
        stroke={lineColor}
        strokeWidth={isDeleteMode ? 4 : 2}
        opacity={isActive ? 0.8 : 0.4}
        lineCap="round"
        lineJoin="round"
        dash={isActive ? undefined : [10, 5]}
        shadowColor={lineColor}
        shadowBlur={isActive ? 10 : 0}
        shadowOpacity={0.5}
        hitStrokeWidth={20}
      />

      {/* Animated particle (data flow indicator) */}
      {connection.animated && isActive && (
        <Circle
          ref={particleRef}
          radius={4}
          fill="#ffffff"
          shadowColor={lineColor}
          shadowBlur={15}
          shadowOpacity={1}
        />
      )}

      {/* Midpoint label (bandwidth if set) */}
      {connection.bandwidth && (
        <Group
          x={(sourceNode.positionX + targetNode.positionX) / 2}
          y={(sourceNode.positionY + targetNode.positionY) / 2 - 12}
        >
          {/* Background */}
          <Konva.Rect
            x={-25}
            y={-8}
            width={50}
            height={16}
            fill="#12121a"
            cornerRadius={4}
            opacity={0.9}
          />
          {/* Text would go here but Konva Text in Group needs special handling */}
        </Group>
      )}
    </Group>
  );
}




