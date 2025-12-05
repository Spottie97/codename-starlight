import { Shape } from 'react-konva';

interface GridBackgroundProps {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  gridSize?: number;
}

export function GridBackground({ 
  width, 
  height, 
  offsetX = 0, 
  offsetY = 0,
  gridSize = 50 
}: GridBackgroundProps) {
  return (
    <Shape
      x={offsetX}
      y={offsetY}
      sceneFunc={(context, shape) => {
        context.beginPath();
        
        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }
        
        context.strokeStyle = 'rgba(5, 217, 232, 0.05)';
        context.lineWidth = 1;
        context.stroke();

        // Major grid lines (every 5 cells)
        context.beginPath();
        for (let x = 0; x <= width; x += gridSize * 5) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += gridSize * 5) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }
        context.strokeStyle = 'rgba(5, 217, 232, 0.1)';
        context.lineWidth = 1;
        context.stroke();

        context.fillStrokeShape(shape);
      }}
    />
  );
}



