/**
 * SNMP Service for network device polling
 * Uses the 'net-snmp' package for SNMP v1/v2c/v3 queries
 */

import snmp from 'net-snmp';

export interface SNMPResult {
  alive: boolean;
  sysUpTime?: number; // in ticks (1/100th seconds)
  sysName?: string;
  sysDescr?: string;
  latency: number | null;
  error?: string;
}

// Common SNMP OIDs
const OID = {
  sysDescr: '1.3.6.1.2.1.1.1.0',    // System description
  sysObjectID: '1.3.6.1.2.1.1.2.0', // System OID
  sysUpTime: '1.3.6.1.2.1.1.3.0',   // System uptime in ticks
  sysContact: '1.3.6.1.2.1.1.4.0',  // System contact
  sysName: '1.3.6.1.2.1.1.5.0',     // System name (hostname)
  sysLocation: '1.3.6.1.2.1.1.6.0', // System location
};

/**
 * Query a device via SNMP
 * @param host - IP address or hostname
 * @param community - SNMP community string (default: 'public')
 * @param version - SNMP version ('1', '2c', or '3')
 * @param timeout - Timeout in milliseconds (default: 5000)
 */
export async function snmpQuery(
  host: string,
  community: string = 'public',
  version: string = '2c',
  timeout: number = 5000
): Promise<SNMPResult> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    // Determine SNMP version
    let snmpVersion: number;
    switch (version) {
      case '1':
        snmpVersion = snmp.Version1;
        break;
      case '2c':
      default:
        snmpVersion = snmp.Version2c;
        break;
    }

    const session = snmp.createSession(host, community, {
      port: 161,
      retries: 1,
      timeout,
      version: snmpVersion,
    });

    // Query basic system info
    const oids = [OID.sysUpTime, OID.sysName, OID.sysDescr];

    session.get(oids, (error: Error | null, varbinds: snmp.VarBind[]) => {
      const latency = Date.now() - startTime;
      session.close();

      if (error) {
        resolve({
          alive: false,
          latency: null,
          error: error.message,
        });
        return;
      }

      // Check for SNMP errors in varbinds
      const hasErrors = varbinds.some(
        (vb) => snmp.isVarbindError(vb)
      );

      if (hasErrors) {
        resolve({
          alive: false,
          latency,
          error: 'SNMP query returned errors',
        });
        return;
      }

      // Extract values
      let sysUpTime: number | undefined;
      let sysName: string | undefined;
      let sysDescr: string | undefined;

      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) {
          if (vb.oid === OID.sysUpTime) {
            sysUpTime = Number(vb.value);
          } else if (vb.oid === OID.sysName) {
            sysName = vb.value?.toString();
          } else if (vb.oid === OID.sysDescr) {
            sysDescr = vb.value?.toString();
          }
        }
      }

      resolve({
        alive: true,
        sysUpTime,
        sysName,
        sysDescr,
        latency,
      });
    });
  });
}

/**
 * Simple SNMP connectivity check (just checks if device responds)
 * @param host - IP address or hostname
 * @param community - SNMP community string
 * @param version - SNMP version
 */
export async function snmpCheck(
  host: string,
  community: string = 'public',
  version: string = '2c'
): Promise<{ alive: boolean; latency: number | null }> {
  const result = await snmpQuery(host, community, version);
  return {
    alive: result.alive,
    latency: result.latency,
  };
}

/**
 * Query SNMP with retry logic
 * @param host - IP address or hostname
 * @param community - SNMP community string
 * @param version - SNMP version
 * @param retries - Number of retries
 */
export async function snmpQueryWithRetry(
  host: string,
  community: string = 'public',
  version: string = '2c',
  retries: number = 2
): Promise<SNMPResult> {
  let lastResult: SNMPResult = { alive: false, latency: null };
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await snmpQuery(host, community, version);
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


