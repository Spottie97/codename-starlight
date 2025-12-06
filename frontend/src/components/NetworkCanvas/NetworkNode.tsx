import { useRef, useEffect, useState, useMemo } from 'react';
import { Group, Circle, Text, Ring, Rect, RegularPolygon, Line } from 'react-konva';
import Konva from 'konva';
import type { NetworkNode as INetworkNode, EditorMode, MonitoringMethod } from '../../types/network';
import { STATUS_COLORS, NODE_TYPE_LABELS } from '../../types/network';
import { useGlobalAnimation, calculatePulse, getStaticPulse, usePerformanceSettings, useGlowEffects } from '../../hooks/useGlobalAnimation';

// Monitoring method badge colors
const MONITORING_METHOD_COLORS: Record<MonitoringMethod, string> = {
  MQTT: '#05d9e8',  // Cyan
  PING: '#39ff14',  // Green
  SNMP: '#d300c5',  // Purple
  HTTP: '#ff6b35',  // Orange
  NONE: '#6b7280',  // Gray
};

// Monitoring method badge labels
const MONITORING_METHOD_SHORT: Record<MonitoringMethod, string> = {
  MQTT: 'M',
  PING: 'P',
  SNMP: 'S',
  HTTP: 'H',
  NONE: '-',
};

// Special node type colors
const INTERNET_COLOR = '#00bfff';  // Deep sky blue
const MAIN_LINK_COLOR = '#ffd700'; // Gold

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
  const [isHovered, setIsHovered] = useState(false);
  
  // Performance settings
  const perfSettings = usePerformanceSettings();
  const enableGlow = useGlowEffects();
  const animationsEnabled = perfSettings.animationMode !== 'off';

  const isInternetNode = node.type === 'INTERNET';
  const isMainLinkNode = node.type === 'MAIN_LINK';
  const isSpecialNode = isInternetNode || isMainLinkNode;

  // For INTERNET nodes, use internetStatus as primary status
  const primaryStatus = isInternetNode ? node.internetStatus : node.status;
  const statusColor = STATUS_COLORS[primaryStatus] || STATUS_COLORS.UNKNOWN;
  
  // Special nodes are larger
  const nodeRadius = isSpecialNode ? 40 : 30;

  // Use global animation for pulse effect (shared across all nodes - much more efficient)
  // FPS is automatically reduced in 'reduced' mode by the hook
  const animationTime = useGlobalAnimation(30);
  const pulsePeriod = isInternetNode ? 1500 : 2000;
  const shouldAnimate = animationsEnabled && (primaryStatus === 'ONLINE' || primaryStatus === 'OFFLINE' || primaryStatus === 'DEGRADED');
  
  // Calculate pulse values from global time (no individual animation loops)
  // Returns static values when animations are off
  const pulse = useMemo(() => {
    if (!shouldAnimate) return getStaticPulse();
    return calculatePulse(animationTime, pulsePeriod);
  }, [animationTime, pulsePeriod, shouldAnimate]);

  // Hover effect - skip animation when animations are disabled
  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    const targetScale = (isHovered || isSelected) ? 1.1 : 1;
    
    if (animationsEnabled) {
      group.to({
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 0.2,
      });
    } else {
      // Instant scale change when animations disabled
      group.scaleX(targetScale);
      group.scaleY(targetScale);
    }
  }, [isHovered, isSelected, animationsEnabled]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Stop propagation to prevent the Stage from thinking it was dragged
    e.cancelBubble = true;
    const newX = e.target.x();
    const newY = e.target.y();
    onDragEnd(newX, newY);
  };

  const isDraggable = editorMode === 'select';

  // Render INTERNET node (cloud-like shape)
  if (isInternetNode) {
    return (
      <Group
        ref={groupRef}
        x={node.positionX}
        y={node.positionY}
        draggable={isDraggable}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragMove={(e) => { e.cancelBubble = true; }}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.cancelBubble = true; onClick(); }}
        onTap={(e) => { e.cancelBubble = true; onClick(); }}
        onMouseEnter={() => {
          setIsHovered(true);
          document.body.style.cursor = editorMode === 'delete' ? 'not-allowed' : 'pointer';
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        {/* Status pulse ring - uses global animation */}
        <Ring
          innerRadius={nodeRadius}
          outerRadius={nodeRadius + 12}
          fill={statusColor}
          opacity={pulse.opacity}
          scaleX={pulse.scale}
          scaleY={pulse.scale}
        />

        {/* Selection ring */}
        {(isSelected || isConnecting) && (
          <Ring
            innerRadius={nodeRadius + 6}
            outerRadius={nodeRadius + 14}
            fill="transparent"
            stroke={isConnecting ? '#fffc00' : '#05d9e8'}
            strokeWidth={3}
            dash={[8, 4]}
          />
        )}

        {/* Cloud shape - outer ring */}
        <Circle
          radius={nodeRadius}
          fill="#12121a"
          stroke={INTERNET_COLOR}
          strokeWidth={4}
          shadowColor={enableGlow ? INTERNET_COLOR : undefined}
          shadowBlur={enableGlow ? (isHovered ? 30 : 20) : 0}
          shadowOpacity={enableGlow ? 0.9 : 0}
        />

        {/* Cloud inner decoration - three overlapping circles */}
        <Circle x={-12} y={5} radius={12} fill="transparent" stroke={INTERNET_COLOR} strokeWidth={2} opacity={0.4} />
        <Circle x={12} y={5} radius={12} fill="transparent" stroke={INTERNET_COLOR} strokeWidth={2} opacity={0.4} />
        <Circle x={0} y={-8} radius={14} fill="transparent" stroke={INTERNET_COLOR} strokeWidth={2} opacity={0.4} />

        {/* Center status indicator - larger for internet nodes */}
        <Circle
          radius={12}
          fill={statusColor}
          shadowColor={enableGlow ? statusColor : undefined}
          shadowBlur={enableGlow ? 20 : 0}
          shadowOpacity={enableGlow ? 1 : 0}
        />

        {/* "WAN" label inside */}
        <Text
          text="WAN"
          fontSize={10}
          fontFamily="Orbitron"
          fontStyle="bold"
          fill="#12121a"
          align="center"
          width={30}
          offsetX={15}
          offsetY={5}
        />

        {/* Node name */}
        <Text
          text={node.name}
          fontSize={14}
          fontFamily="Rajdhani"
          fontStyle="700"
          fill="#ffffff"
          y={nodeRadius + 12}
          align="center"
          width={120}
          offsetX={60}
        />

        {/* Status label */}
        <Text
          text={primaryStatus === 'ONLINE' ? '● CONNECTED' : primaryStatus === 'OFFLINE' ? '● DISCONNECTED' : '● CHECKING...'}
          fontSize={10}
          fontFamily="Orbitron"
          fill={statusColor}
          y={nodeRadius + 28}
          align="center"
          width={120}
          offsetX={60}
        />

        {/* Latency display */}
        {node.latency !== null && (
          <Text
            text={`${node.latency}ms`}
            fontSize={11}
            fontFamily="Orbitron"
            fill={node.latency < 50 ? '#39ff14' : node.latency < 100 ? '#fffc00' : '#ff2a6d'}
            y={-nodeRadius - 22}
            align="center"
            width={60}
            offsetX={30}
          />
        )}
      </Group>
    );
  }

  // Render MAIN_LINK node (diamond/hexagon shape with gold accent)
  if (isMainLinkNode) {
    return (
      <Group
        ref={groupRef}
        x={node.positionX}
        y={node.positionY}
        draggable={isDraggable}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragMove={(e) => { e.cancelBubble = true; }}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.cancelBubble = true; onClick(); }}
        onTap={(e) => { e.cancelBubble = true; onClick(); }}
        onMouseEnter={() => {
          setIsHovered(true);
          document.body.style.cursor = editorMode === 'delete' ? 'not-allowed' : 'pointer';
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        {/* Status pulse ring - uses global animation */}
        <Ring
          innerRadius={nodeRadius}
          outerRadius={nodeRadius + 12}
          fill={statusColor}
          opacity={pulse.opacity}
          scaleX={pulse.scale}
          scaleY={pulse.scale}
        />

        {/* Selection ring */}
        {(isSelected || isConnecting) && (
          <RegularPolygon
            sides={6}
            radius={nodeRadius + 14}
            fill="transparent"
            stroke={isConnecting ? '#fffc00' : '#05d9e8'}
            strokeWidth={3}
            dash={[8, 4]}
            rotation={30}
          />
        )}

        {/* Hexagon shape - outer */}
        <RegularPolygon
          sides={6}
          radius={nodeRadius}
          fill="#12121a"
          stroke={MAIN_LINK_COLOR}
          strokeWidth={4}
          shadowColor={enableGlow ? MAIN_LINK_COLOR : undefined}
          shadowBlur={enableGlow ? (isHovered ? 30 : 20) : 0}
          shadowOpacity={enableGlow ? 0.9 : 0}
          rotation={30}
        />

        {/* Inner hexagon decoration */}
        <RegularPolygon
          sides={6}
          radius={nodeRadius - 10}
          fill="transparent"
          stroke={MAIN_LINK_COLOR}
          strokeWidth={2}
          opacity={0.5}
          rotation={30}
        />

        {/* Network lines inside - representing connections */}
        <Line points={[-15, 0, 15, 0]} stroke={MAIN_LINK_COLOR} strokeWidth={2} opacity={0.6} />
        <Line points={[0, -15, 0, 15]} stroke={MAIN_LINK_COLOR} strokeWidth={2} opacity={0.6} />
        <Line points={[-10, -10, 10, 10]} stroke={MAIN_LINK_COLOR} strokeWidth={2} opacity={0.4} />
        <Line points={[-10, 10, 10, -10]} stroke={MAIN_LINK_COLOR} strokeWidth={2} opacity={0.4} />

        {/* Center status indicator */}
        <Circle
          radius={10}
          fill={statusColor}
          shadowColor={enableGlow ? statusColor : undefined}
          shadowBlur={enableGlow ? 18 : 0}
          shadowOpacity={enableGlow ? 1 : 0}
        />

        {/* Internet status indicator - prominent for main link */}
        <Circle
          x={nodeRadius - 8}
          y={-nodeRadius + 8}
          radius={8}
          fill={STATUS_COLORS[node.internetStatus] || STATUS_COLORS.UNKNOWN}
          stroke="#12121a"
          strokeWidth={2}
          shadowColor={enableGlow ? (STATUS_COLORS[node.internetStatus] || STATUS_COLORS.UNKNOWN) : undefined}
          shadowBlur={enableGlow ? 8 : 0}
        />

        {/* Node name */}
        <Text
          text={node.name}
          fontSize={14}
          fontFamily="Rajdhani"
          fontStyle="700"
          fill="#ffffff"
          y={nodeRadius + 12}
          align="center"
          width={120}
          offsetX={60}
        />

        {/* Node type label */}
        <Text
          text="MAIN ENTRY"
          fontSize={10}
          fontFamily="Orbitron"
          fill={MAIN_LINK_COLOR}
          y={nodeRadius + 28}
          align="center"
          width={120}
          offsetX={60}
        />

        {/* Latency display */}
        {node.latency !== null && (
          <Text
            text={`${node.latency}ms`}
            fontSize={11}
            fontFamily="Orbitron"
            fill={node.latency < 50 ? '#39ff14' : node.latency < 100 ? '#fffc00' : '#ff2a6d'}
            y={-nodeRadius - 22}
            align="center"
            width={60}
            offsetX={30}
          />
        )}
      </Group>
    );
  }

  // Default node rendering (original)
  return (
    <Group
      ref={groupRef}
      x={node.positionX}
      y={node.positionY}
      draggable={isDraggable}
      onDragStart={(e) => {
        // Stop propagation to prevent Stage drag
        e.cancelBubble = true;
      }}
      onDragMove={(e) => {
        // Stop propagation to prevent Stage drag
        e.cancelBubble = true;
      }}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        document.body.style.cursor = editorMode === 'delete' ? 'not-allowed' : 'pointer';
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Status pulse ring - uses global animation */}
      <Ring
        innerRadius={nodeRadius}
        outerRadius={nodeRadius + 8}
        fill={statusColor}
        opacity={pulse.opacity * 0.75}
        scaleX={pulse.scale}
        scaleY={pulse.scale}
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
        shadowColor={enableGlow ? node.color : undefined}
        shadowBlur={enableGlow ? (isHovered ? 20 : 10) : 0}
        shadowOpacity={enableGlow ? 0.8 : 0}
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
        shadowColor={enableGlow ? statusColor : undefined}
        shadowBlur={enableGlow ? 15 : 0}
        shadowOpacity={enableGlow ? 1 : 0}
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

      {/* Monitoring method badge */}
      {node.monitoringMethod && node.monitoringMethod !== 'NONE' && (
        <Group x={-nodeRadius + 2} y={-nodeRadius + 2}>
          <Rect
            width={14}
            height={14}
            cornerRadius={3}
            fill={MONITORING_METHOD_COLORS[node.monitoringMethod] || '#6b7280'}
            shadowColor={enableGlow ? (MONITORING_METHOD_COLORS[node.monitoringMethod] || '#6b7280') : undefined}
            shadowBlur={enableGlow ? 5 : 0}
            shadowOpacity={enableGlow ? 0.5 : 0}
          />
          <Text
            text={MONITORING_METHOD_SHORT[node.monitoringMethod] || '?'}
            fontSize={9}
            fontFamily="Orbitron"
            fontStyle="bold"
            fill="#12121a"
            width={14}
            height={14}
            align="center"
            verticalAlign="middle"
            offsetY={-2}
          />
        </Group>
      )}

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
        text={NODE_TYPE_LABELS[node.type] || node.type}
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




