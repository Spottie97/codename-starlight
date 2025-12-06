import { useEffect, useState, useSyncExternalStore } from 'react';

// Animation mode types
export type AnimationMode = 'full' | 'reduced' | 'off';

// Performance settings stored globally
interface PerformanceSettings {
  animationMode: AnimationMode;
  enableGlowEffects: boolean;
  autoReduceAnimations: boolean;
  autoReduceThreshold: number; // Number of nodes that triggers auto-reduce
}

// Default settings
const defaultSettings: PerformanceSettings = {
  animationMode: 'full',
  enableGlowEffects: true,
  autoReduceAnimations: true,
  autoReduceThreshold: 50, // Auto-reduce when > 50 nodes
};

// Track current node count for auto-reduce feature
let currentNodeCount = 0;
let isAutoReduced = false;

// Storage key for localStorage
const PERFORMANCE_SETTINGS_KEY = 'starlight-performance-settings';

// Load settings from localStorage
function loadSettings(): PerformanceSettings {
  try {
    const stored = localStorage.getItem(PERFORMANCE_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        animationMode: parsed.animationMode || defaultSettings.animationMode,
        enableGlowEffects: parsed.enableGlowEffects ?? defaultSettings.enableGlowEffects,
        autoReduceAnimations: parsed.autoReduceAnimations ?? defaultSettings.autoReduceAnimations,
        autoReduceThreshold: parsed.autoReduceThreshold ?? defaultSettings.autoReduceThreshold,
      };
    }
  } catch (e) {
    console.warn('Failed to load performance settings from localStorage:', e);
  }
  return defaultSettings;
}

// Save settings to localStorage
function saveSettings(settings: PerformanceSettings): void {
  try {
    localStorage.setItem(PERFORMANCE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save performance settings to localStorage:', e);
  }
}

// Global performance settings state
let performanceSettings: PerformanceSettings = loadSettings();
let settingsListeners = new Set<() => void>();

// Notify all listeners of settings change
function notifySettingsListeners() {
  settingsListeners.forEach(listener => listener());
}

// Global animation state - shared across all components
let globalAnimationFrame: number | null = null;
let globalTime = 0;
let subscribers = new Set<(time: number) => void>();

// Start the global animation loop if not already running
function startGlobalAnimation() {
  if (globalAnimationFrame !== null) return;
  if (performanceSettings.animationMode === 'off') return;
  
  let lastTime = performance.now();
  
  const animate = (currentTime: number) => {
    // Stop if animation mode was changed to 'off'
    if (performanceSettings.animationMode === 'off') {
      globalAnimationFrame = null;
      return;
    }
    
    const delta = currentTime - lastTime;
    lastTime = currentTime;
    globalTime += delta;
    
    // Notify all subscribers
    subscribers.forEach(callback => callback(globalTime));
    
    globalAnimationFrame = requestAnimationFrame(animate);
  };
  
  globalAnimationFrame = requestAnimationFrame(animate);
}

// Stop the global animation loop if no subscribers or animation disabled
function stopGlobalAnimation() {
  if (globalAnimationFrame !== null && (subscribers.size === 0 || performanceSettings.animationMode === 'off')) {
    cancelAnimationFrame(globalAnimationFrame);
    globalAnimationFrame = null;
  }
}

/**
 * Set the global animation mode
 * @param mode - 'full', 'reduced', or 'off'
 */
export function setAnimationMode(mode: AnimationMode): void {
  performanceSettings = { ...performanceSettings, animationMode: mode };
  saveSettings(performanceSettings);
  notifySettingsListeners();
  
  // Handle animation loop based on mode
  if (mode === 'off') {
    stopGlobalAnimation();
  } else if (subscribers.size > 0) {
    startGlobalAnimation();
  }
  
  // Update CSS class on body for CSS-based animations
  document.body.classList.remove('animation-full', 'animation-reduced', 'animation-off');
  document.body.classList.add(`animation-${mode}`);
}

/**
 * Set whether glow effects are enabled
 * @param enabled - true to enable, false to disable
 */
export function setGlowEffectsEnabled(enabled: boolean): void {
  performanceSettings = { ...performanceSettings, enableGlowEffects: enabled };
  saveSettings(performanceSettings);
  notifySettingsListeners();
  
  // Update CSS class on body
  document.body.classList.toggle('glow-disabled', !enabled);
}

/**
 * Set auto-reduce animations setting
 * @param enabled - true to enable auto-reduce for large networks
 */
export function setAutoReduceAnimations(enabled: boolean): void {
  performanceSettings = { ...performanceSettings, autoReduceAnimations: enabled };
  saveSettings(performanceSettings);
  notifySettingsListeners();
  
  // Re-evaluate auto-reduce state
  checkAutoReduce();
}

/**
 * Set the threshold for auto-reduce animations
 * @param threshold - Number of nodes that triggers auto-reduce
 */
export function setAutoReduceThreshold(threshold: number): void {
  performanceSettings = { ...performanceSettings, autoReduceThreshold: Math.max(10, threshold) };
  saveSettings(performanceSettings);
  notifySettingsListeners();
  
  // Re-evaluate auto-reduce state
  checkAutoReduce();
}

/**
 * Update the current node count and check if auto-reduce should be applied
 * @param count - Current number of nodes in the canvas
 */
export function updateNodeCount(count: number): void {
  currentNodeCount = count;
  checkAutoReduce();
}

/**
 * Check if auto-reduce should be applied based on current node count
 */
function checkAutoReduce(): void {
  if (!performanceSettings.autoReduceAnimations) {
    // Auto-reduce is disabled, restore to user's setting if we had auto-reduced
    if (isAutoReduced) {
      isAutoReduced = false;
      // Restore animations - don't change saved settings, just internal state
      if (performanceSettings.animationMode !== 'off') {
        startGlobalAnimation();
      }
      document.body.classList.remove('auto-performance-mode');
    }
    return;
  }
  
  const shouldReduce = currentNodeCount > performanceSettings.autoReduceThreshold;
  
  if (shouldReduce && !isAutoReduced) {
    // Apply auto-reduce
    isAutoReduced = true;
    stopGlobalAnimation();
    document.body.classList.add('auto-performance-mode');
    notifySettingsListeners();
    console.log(`⚡ Auto-performance mode: Animations reduced (${currentNodeCount} nodes)`);
  } else if (!shouldReduce && isAutoReduced) {
    // Remove auto-reduce
    isAutoReduced = false;
    if (performanceSettings.animationMode !== 'off' && subscribers.size > 0) {
      startGlobalAnimation();
    }
    document.body.classList.remove('auto-performance-mode');
    notifySettingsListeners();
    console.log(`⚡ Auto-performance mode: Animations restored (${currentNodeCount} nodes)`);
  }
}

/**
 * Get whether auto-reduce is currently active
 */
export function isAutoReduceActive(): boolean {
  return isAutoReduced;
}

/**
 * Get current animation mode
 */
export function getAnimationMode(): AnimationMode {
  return performanceSettings.animationMode;
}

/**
 * Get whether glow effects are enabled
 */
export function getGlowEffectsEnabled(): boolean {
  return performanceSettings.enableGlowEffects;
}

/**
 * Get all performance settings
 */
export function getPerformanceSettings(): PerformanceSettings {
  return { ...performanceSettings };
}

/**
 * Get auto-reduce animations setting
 */
export function getAutoReduceAnimations(): boolean {
  return performanceSettings.autoReduceAnimations;
}

/**
 * Get auto-reduce threshold
 */
export function getAutoReduceThreshold(): number {
  return performanceSettings.autoReduceThreshold;
}

/**
 * Initialize performance settings - call this on app startup
 * Sets up initial CSS classes based on saved settings
 */
export function initPerformanceSettings(): void {
  const settings = loadSettings();
  performanceSettings = settings;
  
  // Set initial CSS classes
  document.body.classList.add(`animation-${settings.animationMode}`);
  if (!settings.enableGlowEffects) {
    document.body.classList.add('glow-disabled');
  }
}

/**
 * Hook to subscribe to performance settings changes
 */
export function usePerformanceSettings(): PerformanceSettings {
  return useSyncExternalStore(
    (callback) => {
      settingsListeners.add(callback);
      return () => settingsListeners.delete(callback);
    },
    () => performanceSettings,
    () => defaultSettings
  );
}

/**
 * Hook to get global animation time - shares a single RAF loop across all nodes
 * This is much more efficient than creating individual Konva.Animation per node
 * 
 * Respects animation mode setting:
 * - 'full': Updates at requested FPS (default 30)
 * - 'reduced': Updates at half the requested FPS (max 15)
 * - 'off': Returns static time (no updates)
 * 
 * Also respects auto-reduce state when enabled and node count exceeds threshold
 * 
 * @param fps - Target frames per second for updates (default: 30 for performance)
 * @returns Current animation time in milliseconds
 */
export function useGlobalAnimation(fps: number = 30): number {
  const settings = usePerformanceSettings();
  const [time, setTime] = useState(globalTime);
  
  // Check if animations should be paused due to auto-reduce
  const animationsEnabled = settings.animationMode !== 'off' && !isAutoReduced;
  
  // Adjust FPS based on animation mode
  const effectiveFps = settings.animationMode === 'reduced' 
    ? Math.min(fps / 2, 15) 
    : fps;
  const frameInterval = 1000 / effectiveFps;
  
  useEffect(() => {
    // If animations are off or auto-reduced, don't subscribe
    if (!animationsEnabled) {
      return;
    }
    
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
  }, [frameInterval, animationsEnabled]);
  
  return time;
}

/**
 * Hook to track if auto-reduce is currently active
 */
export function useAutoReduceStatus(): boolean {
  // Re-render when settings change (which includes auto-reduce state changes)
  usePerformanceSettings();
  return isAutoReduced;
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
 * Calculate static pulse values (for when animations are off)
 */
export function getStaticPulse(): { scale: number; opacity: number } {
  return {
    scale: 1,
    opacity: 0.4,
  };
}

/**
 * Hook to get pulse animation values - convenience wrapper
 * Returns static values when animations are off
 * @param period - Pulse period in milliseconds
 * @param fps - Target FPS for animation (default: 30)
 */
export function usePulseAnimation(period: number = 2000, fps: number = 30): { scale: number; opacity: number } {
  const settings = usePerformanceSettings();
  const time = useGlobalAnimation(fps);
  
  if (settings.animationMode === 'off') {
    return getStaticPulse();
  }
  
  return calculatePulse(time, period);
}

/**
 * Hook to check if glow effects should be rendered
 * Used by components to conditionally render expensive shadow/glow effects
 */
export function useGlowEffects(): boolean {
  const settings = usePerformanceSettings();
  return settings.enableGlowEffects;
}
