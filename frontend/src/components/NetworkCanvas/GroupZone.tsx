import { useRef, useState, useEffect, memo } from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import Konva from 'konva';
import type { NodeGroup, EditorMode } from '../../types/network';

interface GroupZoneProps {
  group: NodeGroup;
  isSelected: boolean;
  isConnecting?: boolean;
  onClick: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  editorMode: EditorMode;
}

// Minimum dimensions for groups
const MIN_WIDTH = 150;
const MIN_HEIGHT = 100;
const HEADER_HEIGHT = 28;
const CORNER_RADIUS = 8;
const RESIZE_HANDLE_SIZE = 12;

// Custom comparison function for memoization
function areGroupPropsEqual(prevProps: GroupZoneProps, nextProps: GroupZoneProps): boolean {
  // Check primitive props
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isConnecting !== nextProps.isConnecting) return false;
  if (prevProps.editorMode !== nextProps.editorMode) return false;
  
  // Check group data that affects rendering
  const prevGroup = prevProps.group;
  const nextGroup = nextProps.group;
  if (prevGroup.id !== nextGroup.id) return false;
  if (prevGroup.positionX !== nextGroup.positionX) return false;
  if (prevGroup.positionY !== nextGroup.positionY) return false;
  if (prevGroup.width !== nextGroup.width) return false;
  if (prevGroup.height !== nextGroup.height) return false;
  if (prevGroup.name !== nextGroup.name) return false;
  if (prevGroup.color !== nextGroup.color) return false;
  if (prevGroup.opacity !== nextGroup.opacity) return false;
  
  return true;
}

export const GroupZone = memo(function GroupZone({
  group,
  isSelected,
  isConnecting = false,
  onClick,
  onDragEnd,
  onResize,
  editorMode,
}: GroupZoneProps) {
  const groupRef = useRef<Konva.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Handle drag end
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Stop propagation to prevent the Stage from thinking it was dragged
    e.cancelBubble = true;
    if (isResizing) return;
    const newX = e.target.x();
    const newY = e.target.y();
    onDragEnd(newX, newY);
  };

  // Hover effect
  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    if (isHovered || isSelected) {
      group.to({
        opacity: 1,
        duration: 0.15,
      });
    } else {
      group.to({
        opacity: 0.9,
        duration: 0.15,
      });
    }
  }, [isHovered, isSelected]);

  const isDraggable = editorMode === 'select' && !isResizing;

  // Get a contrasting header color (darker version of group color)
  const headerColor = adjustColorBrightness(group.color, -40);
  
  // Convert hex to rgba for fill
  const fillColor = hexToRgba(group.color, group.opacity);
  
  return (
    <Group
      ref={groupRef}
      x={group.positionX}
      y={group.positionY}
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
        if (editorMode === 'select') {
          document.body.style.cursor = 'move';
        } else if (editorMode === 'connectGroups') {
          document.body.style.cursor = 'pointer';
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isResizing) {
          document.body.style.cursor = 'default';
        }
      }}
      opacity={0.9}
    >
      {/* Main background */}
      <Rect
        width={group.width}
        height={group.height}
        fill={fillColor}
        cornerRadius={CORNER_RADIUS}
        stroke={isConnecting ? '#fffc00' : isSelected ? '#05d9e8' : group.color}
        strokeWidth={isConnecting || isSelected ? 2 : 1}
        shadowColor={isConnecting ? '#fffc00' : group.color}
        shadowBlur={isConnecting ? 25 : isSelected ? 20 : 8}
        shadowOpacity={isConnecting ? 0.7 : 0.4}
        shadowForStrokeEnabled={false}
        perfectDrawEnabled={false}
      />

      {/* Header bar */}
      <Rect
        width={group.width}
        height={HEADER_HEIGHT}
        fill={headerColor}
        cornerRadius={[CORNER_RADIUS, CORNER_RADIUS, 0, 0]}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Header separator line */}
      <Rect
        y={HEADER_HEIGHT - 1}
        width={group.width}
        height={1}
        fill={group.color}
        opacity={0.5}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Group name */}
      <Text
        text={group.name.toUpperCase()}
        fontSize={11}
        fontFamily="Orbitron"
        fontStyle="bold"
        fill="#ffffff"
        x={10}
        y={8}
        width={group.width - 20}
        ellipsis={true}
        wrap="none"
        listening={false}
      />

      {/* Node count indicator */}
      <Group x={group.width - 30} y={7} listening={false}>
        <Circle
          radius={8}
          fill={group.color}
          opacity={0.3}
          perfectDrawEnabled={false}
        />
        <Text
          text="•"
          fontSize={16}
          fontFamily="Rajdhani"
          fill={group.color}
          offsetX={3}
          offsetY={-2}
          listening={false}
        />
      </Group>

      {/* Selection highlight border */}
      {isSelected && (
        <Rect
          width={group.width}
          height={group.height}
          fill="transparent"
          stroke="#05d9e8"
          strokeWidth={2}
          cornerRadius={CORNER_RADIUS}
          dash={[8, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Connecting highlight border */}
      {isConnecting && (
        <Rect
          width={group.width}
          height={group.height}
          fill="transparent"
          stroke="#fffc00"
          strokeWidth={3}
          cornerRadius={CORNER_RADIUS}
          dash={[10, 5]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Resize handle (bottom-right corner) - always visible in select mode */}
      {editorMode === 'select' && (
        <Rect
          x={group.width - RESIZE_HANDLE_SIZE - 2}
          y={group.height - RESIZE_HANDLE_SIZE - 2}
          width={RESIZE_HANDLE_SIZE + 4}
          height={RESIZE_HANDLE_SIZE + 4}
          fill={group.color}
          cornerRadius={[0, 0, CORNER_RADIUS, 0]}
          opacity={isSelected || isHovered ? 0.9 : 0.5}
          draggable={true}
          onMouseEnter={() => {
            document.body.style.cursor = 'nwse-resize';
          }}
          onMouseLeave={() => {
            if (!isResizing) {
              document.body.style.cursor = 'default';
            }
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
            setResizeStart({
              x: e.target.x(),
              y: e.target.y(),
              width: group.width,
              height: group.height,
            });
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            
            // Get the handle's new position relative to the group
            const handleX = e.target.x();
            const handleY = e.target.y();
            
            // Calculate new width/height based on handle position
            const newWidth = Math.max(MIN_WIDTH, handleX + RESIZE_HANDLE_SIZE + 2);
            const newHeight = Math.max(MIN_HEIGHT, handleY + RESIZE_HANDLE_SIZE + 2);
            
            // Keep handle at the edge
            e.target.x(newWidth - RESIZE_HANDLE_SIZE - 2);
            e.target.y(newHeight - RESIZE_HANDLE_SIZE - 2);
            
            onResize(newWidth, newHeight);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            setIsResizing(false);
            document.body.style.cursor = 'default';
          }}
        />
      )}

      {/* Decorative corner accent */}
      <Rect
        x={group.width - 3}
        y={HEADER_HEIGHT}
        width={3}
        height={group.height - HEADER_HEIGHT}
        fill={group.color}
        opacity={0.3}
        cornerRadius={[0, 0, CORNER_RADIUS, 0]}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}, areGroupPropsEqual);

// Helper function to convert hex to rgba
function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(59, 130, 246, ${opacity})`; // Default blue
}

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  
  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);
  
  r = Math.max(0, Math.min(255, r + (r * percent / 100)));
  g = Math.max(0, Math.min(255, g + (g * percent / 100)));
  b = Math.max(0, Math.min(255, b + (b * percent / 100)));
  
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

