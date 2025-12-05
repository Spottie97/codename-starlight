import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Format latency value
 */
export function formatLatency(latency: number | null | undefined): string {
  if (latency === null || latency === undefined) return '-';
  if (latency < 1) return '<1ms';
  return `${latency}ms`;
}

/**
 * Get status color class
 */
export function getStatusColorClass(status: string): string {
  switch (status) {
    case 'ONLINE':
      return 'text-neon-green';
    case 'OFFLINE':
      return 'text-neon-pink';
    case 'DEGRADED':
      return 'text-neon-yellow';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get status background class
 */
export function getStatusBgClass(status: string): string {
  switch (status) {
    case 'ONLINE':
      return 'bg-neon-green/20 border-neon-green/30';
    case 'OFFLINE':
      return 'bg-neon-pink/20 border-neon-pink/30';
    case 'DEGRADED':
      return 'bg-neon-yellow/20 border-neon-yellow/30';
    default:
      return 'bg-gray-500/20 border-gray-500/30';
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}



