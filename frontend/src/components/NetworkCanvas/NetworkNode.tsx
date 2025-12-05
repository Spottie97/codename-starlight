import { useRef, useEffect, useState } from 'react';
import { Group, Circle, Text, Ring } from 'react-konva';
import Konva from 'konva';
import type { NetworkNode as INetworkNode, EditorMode } from '../../types/network';
import { STATUS_COLORS } from '../../types/network';

interface NetworkNodeProps {
  node: INetworkNode;
  isSelected: boolean;
  isConnecting: boolean;
  onClick: () => void;
  onDragEnd: (x: number, y: number) => void;
  editorMode: EditorMode;
}

export function NetworkNode({
  node,
  isSelected,
  isConnecting,
  onClick,
  onDragEnd,
  editorMode,
}: NetworkNodeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const pulseRef = useRef<Konva.Ring>(null);
  const [isHovered, setIsHovered] = useState(false);

  const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.UNKNOWN;
  const nodeRadius = 30;

  // Pulse animation for status
  useEffect(() => {
    if (!pulseRef.current) return;

    const anim = new Konva.Animation((frame) => {
      if (!frame || !pulseRef.current) return;
      
      const period = 2000; // 2 seconds
      const scale = 1 + 0.3 * Math.sin((frame.time * 2 * Math.PI) / period);
      const opacity = 0.6 - 0.4 * Math.sin((frame.time * 2 * Math.PI) / period);
      
      pulseRef.current.scaleX(scale);
      pulseRef.current.scaleY(scale);
      pulseRef.current.opacity(opacity);
    }, pulseRef.current.getLayer());

    if (node.status === 'ONLINE' || node.status === 'OFFLINE' || node.status === 'DEGRADED') {
      anim.start();
    }

    return () => anim.stop();
  }, [node.status]);

  // Hover effect
  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    if (isHovered || isSelected) {
      group.to({
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 0.2,
      });
    } else {
      group.to({
        scaleX: 1,
        scaleY: 1,
        duration: 0.2,
      });
    }
  }, [isHovered, isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y();
    onDragEnd(newX, newY);
  };

  const isDraggable = editorMode === 'select';

  return (
    <Group
      ref={groupRef}
      x={node.positionX}
      y={node.positionY}
      draggable={isDraggable}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => {
        setIsHovered(true);
        document.body.style.cursor = editorMode === 'delete' ? 'not-allowed' : 'pointer';
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Status pulse ring */}
      <Ring
        ref={pulseRef}
        innerRadius={nodeRadius}
        outerRadius={nodeRadius + 8}
        fill={statusColor}
        opacity={0.3}
      />

      {/* Selection ring */}
      {(isSelected || isConnecting) && (
        <Ring
          innerRadius={nodeRadius + 4}
          outerRadius={nodeRadius + 10}
          fill="transparent"
          stroke={isConnecting ? '#fffc00' : '#05d9e8'}
          strokeWidth={2}
          dash={[5, 5]}
          rotation={0}
        />
      )}

      {/* Main node circle */}
      <Circle
        radius={nodeRadius}
        fill="#12121a"
        stroke={node.color}
        strokeWidth={3}
        shadowColor={node.color}
        shadowBlur={isHovered ? 20 : 10}
        shadowOpacity={0.8}
      />

      {/* Inner glow */}
      <Circle
        radius={nodeRadius - 5}
        fill="transparent"
        stroke={statusColor}
        strokeWidth={2}
        opacity={0.5}
      />

      {/* Center status indicator */}
      <Circle
        radius={8}
        fill={statusColor}
        shadowColor={statusColor}
        shadowBlur={15}
        shadowOpacity={1}
      />

      {/* Internet status indicator (small dot) */}
      <Circle
        x={nodeRadius - 5}
        y={-nodeRadius + 5}
        radius={5}
        fill={STATUS_COLORS[node.internetStatus] || STATUS_COLORS.UNKNOWN}
        stroke="#12121a"
        strokeWidth={2}
      />

      {/* Node name */}
      <Text
        text={node.name}
        fontSize={12}
        fontFamily="Rajdhani"
        fontStyle="600"
        fill="#ffffff"
        y={nodeRadius + 10}
        align="center"
        width={100}
        offsetX={50}
      />

      {/* Node type label */}
      <Text
        text={node.type}
        fontSize={9}
        fontFamily="Rajdhani"
        fill="#6b7280"
        y={nodeRadius + 24}
        align="center"
        width={100}
        offsetX={50}
      />

      {/* Latency display (if available) */}
      {node.latency !== null && (
        <Text
          text={`${node.latency}ms`}
          fontSize={10}
          fontFamily="Orbitron"
          fill={node.latency < 50 ? '#39ff14' : node.latency < 100 ? '#fffc00' : '#ff2a6d'}
          y={-nodeRadius - 20}
          align="center"
          width={60}
          offsetX={30}
        />
      )}
    </Group>
  );
}



