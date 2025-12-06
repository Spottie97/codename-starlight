import { useEffect, useState, useCallback } from 'react';

// Global animation state - shared across all components
let globalAnimationFrame: number | null = null;
let globalTime = 0;
let subscribers = new Set<(time: number) => void>();

// Start the global animation loop if not already running
function startGlobalAnimation() {
  if (globalAnimationFrame !== null) return;
  
  let lastTime = performance.now();
  
  const animate = (currentTime: number) => {
    const delta = currentTime - lastTime;
    lastTime = currentTime;
    globalTime += delta;
    
    // Notify all subscribers
    subscribers.forEach(callback => callback(globalTime));
    
    globalAnimationFrame = requestAnimationFrame(animate);
  };
  
  globalAnimationFrame = requestAnimationFrame(animate);
}

// Stop the global animation loop if no subscribers
function stopGlobalAnimation() {
  if (globalAnimationFrame !== null && subscribers.size === 0) {
    cancelAnimationFrame(globalAnimationFrame);
    globalAnimationFrame = null;
  }
}

/**
 * Hook to get global animation time - shares a single RAF loop across all nodes
 * This is much more efficient than creating individual Konva.Animation per node
 * 
 * @param fps - Target frames per second for updates (default: 30 for performance)
 * @returns Current animation time in milliseconds
 */
export function useGlobalAnimation(fps: number = 30): number {
  const [time, setTime] = useState(globalTime);
  const frameInterval = 1000 / fps;
  
  useEffect(() => {
    let lastUpdate = 0;
    
    const callback = (currentTime: number) => {
      // Throttle updates to target FPS
      if (currentTime - lastUpdate >= frameInterval) {
        lastUpdate = currentTime;
        setTime(currentTime);
      }
    };
    
    subscribers.add(callback);
    startGlobalAnimation();
    
    return () => {
      subscribers.delete(callback);
      stopGlobalAnimation();
    };
  }, [frameInterval]);
  
  return time;
}

/**
 * Calculate pulse animation values based on global time
 * @param time - Global animation time
 * @param period - Pulse period in milliseconds (default: 2000)
 * @returns Object with scale and opacity values for pulse effect
 */
export function calculatePulse(time: number, period: number = 2000): { scale: number; opacity: number } {
  const phase = (time * 2 * Math.PI) / period;
  return {
    scale: 1 + 0.3 * Math.sin(phase),
    opacity: 0.6 - 0.4 * Math.sin(phase),
  };
}

/**
 * Hook to get pulse animation values - convenience wrapper
 * @param period - Pulse period in milliseconds
 * @param fps - Target FPS for animation (default: 30)
 */
export function usePulseAnimation(period: number = 2000, fps: number = 30): { scale: number; opacity: number } {
  const time = useGlobalAnimation(fps);
  return calculatePulse(time, period);
}
