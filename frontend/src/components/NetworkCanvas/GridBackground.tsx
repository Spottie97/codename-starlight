import { Shape } from 'react-konva';
import { useMemo } from 'react';

interface GridBackgroundProps {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  gridSize?: number;
  // Canvas transform for virtualization
  canvasScale?: number;
  canvasOffsetX?: number;
  canvasOffsetY?: number;
}

/**
 * Optimized grid background that only renders visible lines
 * Uses virtualization to minimize draw operations
 */
export function GridBackground({ 
  width, 
  height, 
  offsetX = 0, 
  offsetY = 0,
  gridSize = 50,
  canvasScale = 1,
  canvasOffsetX = 0,
  canvasOffsetY = 0,
}: GridBackgroundProps) {
  // Calculate visible bounds based on canvas transform
  // Add padding to prevent visible edges during panning
  const bounds = useMemo(() => {
    const padding = gridSize * 2;
    
    // Calculate visible area in canvas coordinates
    const visibleLeft = (-canvasOffsetX / canvasScale) - padding;
    const visibleTop = (-canvasOffsetY / canvasScale) - padding;
    const visibleRight = visibleLeft + (width / canvasScale) + padding * 2;
    const visibleBottom = visibleTop + (height / canvasScale) + padding * 2;
    
    // Snap to grid for cleaner rendering
    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize;
    
    return { startX, startY, endX, endY };
  }, [width, height, gridSize, canvasScale, canvasOffsetX, canvasOffsetY]);

  return (
    <Shape
      x={offsetX}
      y={offsetY}
      sceneFunc={(context) => {
        const { startX, startY, endX, endY } = bounds;
        
        // Minor grid lines
        context.beginPath();
        
        // Vertical lines (only in visible range)
        for (let x = startX; x <= endX; x += gridSize) {
          context.moveTo(x, startY);
          context.lineTo(x, endY);
        }
        
        // Horizontal lines (only in visible range)
        for (let y = startY; y <= endY; y += gridSize) {
          context.moveTo(startX, y);
          context.lineTo(endX, y);
        }
        
        context.strokeStyle = 'rgba(5, 217, 232, 0.05)';
        context.lineWidth = 1;
        context.stroke();

        // Major grid lines (every 5 cells)
        const majorGridSize = gridSize * 5;
        const majorStartX = Math.floor(startX / majorGridSize) * majorGridSize;
        const majorStartY = Math.floor(startY / majorGridSize) * majorGridSize;
        
        context.beginPath();
        for (let x = majorStartX; x <= endX; x += majorGridSize) {
          context.moveTo(x, startY);
          context.lineTo(x, endY);
        }
        for (let y = majorStartY; y <= endY; y += majorGridSize) {
          context.moveTo(startX, y);
          context.lineTo(endX, y);
        }
        context.strokeStyle = 'rgba(5, 217, 232, 0.1)';
        context.lineWidth = 1;
        context.stroke();
      }}
    />
  );
}
