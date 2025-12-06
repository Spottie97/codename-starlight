/**
 * Ping Service for ICMP health checks
 * Uses the 'ping' package for cross-platform ICMP ping
 */

import ping from 'ping';

export interface PingResult {
  alive: boolean;
  latency: number | null;
  error?: string;
}

/**
 * Ping a host and return the result
 * @param host - IP address or hostname to ping
 * @param timeout - Timeout in seconds (default: 5)
 */
export async function pingHost(host: string, timeout: number = 5): Promise<PingResult> {
  try {
    const result = await ping.promise.probe(host, {
      timeout,
      extra: ['-c', '1'], // Only send 1 packet on Unix
    });

    return {
      alive: result.alive,
      latency: result.alive && result.time !== 'unknown' ? Math.round(Number(result.time)) : null,
    };
  } catch (error) {
    console.error(`Ping error for ${host}:`, error);
    return {
      alive: false,
      latency: null,
      error: error instanceof Error ? error.message : 'Unknown ping error',
    };
  }
}

/**
 * Ping multiple hosts in parallel
 * @param hosts - Array of IP addresses or hostnames
 * @param timeout - Timeout in seconds (default: 5)
 */
export async function pingMultipleHosts(
  hosts: string[],
  timeout: number = 5
): Promise<Map<string, PingResult>> {
  const results = new Map<string, PingResult>();
  
  const pingPromises = hosts.map(async (host) => {
    const result = await pingHost(host, timeout);
    results.set(host, result);
  });

  await Promise.all(pingPromises);
  return results;
}

/**
 * Check if a host is reachable with retries
 * @param host - IP address or hostname
 * @param retries - Number of retry attempts (default: 2)
 * @param timeout - Timeout per attempt in seconds (default: 5)
 */
export async function pingWithRetry(
  host: string,
  retries: number = 2,
  timeout: number = 5
): Promise<PingResult> {
  let lastResult: PingResult = { alive: false, latency: null };
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await pingHost(host, timeout);
    if (lastResult.alive) {
      return lastResult;
    }
    
    // Small delay between retries
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return lastResult;
}


