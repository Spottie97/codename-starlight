/**
 * HTTP Health Check Service
 * Performs HTTP/HTTPS health checks on endpoints
 */

export interface HTTPResult {
  alive: boolean;
  statusCode?: number;
  latency: number | null;
  error?: string;
}

/**
 * Check an HTTP/HTTPS endpoint
 * @param url - Full URL to check (e.g., http://192.168.1.1/status)
 * @param expectedStatusCode - Expected HTTP status code (default: 200)
 * @param timeout - Timeout in milliseconds (default: 5000)
 */
export async function httpCheck(
  url: string,
  expectedStatusCode: number = 200,
  timeout: number = 5000
): Promise<HTTPResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Starlight-Network-Monitor/1.0',
      },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    const alive = response.status === expectedStatusCode;

    return {
      alive,
      statusCode: response.status,
      latency,
      error: alive ? undefined : `Expected ${expectedStatusCode}, got ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `Timeout after ${timeout}ms`;
      } else {
        errorMessage = error.message;
      }
    }

    return {
      alive: false,
      latency: latency < timeout ? latency : null,
      error: errorMessage,
    };
  }
}

/**
 * Check multiple HTTP endpoints in parallel
 * @param urls - Array of URLs to check
 * @param expectedStatusCode - Expected HTTP status code
 * @param timeout - Timeout in milliseconds
 */
export async function httpCheckMultiple(
  urls: string[],
  expectedStatusCode: number = 200,
  timeout: number = 5000
): Promise<Map<string, HTTPResult>> {
  const results = new Map<string, HTTPResult>();

  const checkPromises = urls.map(async (url) => {
    const result = await httpCheck(url, expectedStatusCode, timeout);
    results.set(url, result);
  });

  await Promise.all(checkPromises);
  return results;
}

/**
 * HTTP check with retry logic
 * @param url - URL to check
 * @param expectedStatusCode - Expected HTTP status code
 * @param retries - Number of retries
 * @param timeout - Timeout per attempt in milliseconds
 */
export async function httpCheckWithRetry(
  url: string,
  expectedStatusCode: number = 200,
  retries: number = 2,
  timeout: number = 5000
): Promise<HTTPResult> {
  let lastResult: HTTPResult = { alive: false, latency: null };

  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await httpCheck(url, expectedStatusCode, timeout);
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

/**
 * Build a health check URL from IP and optional path
 * @param ipAddress - IP address
 * @param endpoint - Optional endpoint path (default: '/')
 * @param protocol - HTTP or HTTPS (default: 'http')
 */
export function buildHealthCheckUrl(
  ipAddress: string,
  endpoint: string = '/',
  protocol: 'http' | 'https' = 'http'
): string {
  // Ensure endpoint starts with /
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${protocol}://${ipAddress}${path}`;
}


