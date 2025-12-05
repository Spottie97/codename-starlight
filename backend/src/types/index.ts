import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const NodeTypeEnum = z.enum([
  'PROBE',
  'ROUTER', 
  'SWITCH',
  'SERVER',
  'GATEWAY',
  'ACCESS_POINT',
  'FIREWALL',
  'VIRTUAL'
]);

export const StatusEnum = z.enum([
  'ONLINE',
  'OFFLINE',
  'DEGRADED',
  'UNKNOWN'
]);

export const MonitoringMethodEnum = z.enum([
  'MQTT',
  'PING',
  'SNMP',
  'HTTP',
  'NONE'
]);

export type NodeType = z.infer<typeof NodeTypeEnum>;
export type Status = z.infer<typeof StatusEnum>;
export type MonitoringMethod = z.infer<typeof MonitoringMethodEnum>;

// IP address validation regex
const ipAddressRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Validate IP address or hostname
const ipOrHostname = z.string().refine(
  (val) => ipAddressRegex.test(val) || hostnameRegex.test(val),
  { message: 'Must be a valid IP address or hostname' }
);

// ============================================
// Node Schemas
// ============================================

export const CreateNodeSchema = z.object({
  name: z.string().min(1).max(100),
  type: NodeTypeEnum.optional().default('PROBE'),
  description: z.string().optional(),
  positionX: z.number().optional().default(0),
  positionY: z.number().optional().default(0),
  
  // Monitoring configuration
  monitoringMethod: MonitoringMethodEnum.optional().default('NONE'),
  ipAddress: ipOrHostname.optional(),
  pingInterval: z.number().min(10).max(3600).optional().default(30),
  
  // MQTT configuration (for PROBE type)
  mqttTopic: z.string().optional(),
  
  // SNMP configuration
  snmpCommunity: z.string().optional(),
  snmpVersion: z.enum(['1', '2c', '3']).optional().default('2c'),
  
  // HTTP configuration
  httpEndpoint: z.string().url().optional(),
  httpExpectedCode: z.number().min(100).max(599).optional().default(200),
  
  // Visual customization
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#4F46E5'),
  icon: z.string().optional(),
});

export const UpdateNodeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: NodeTypeEnum.optional(),
  description: z.string().optional().nullable(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  
  // Monitoring configuration
  monitoringMethod: MonitoringMethodEnum.optional(),
  ipAddress: ipOrHostname.optional().nullable(),
  pingInterval: z.number().min(10).max(3600).optional(),
  
  // MQTT configuration
  mqttTopic: z.string().optional().nullable(),
  
  // SNMP configuration
  snmpCommunity: z.string().optional().nullable(),
  snmpVersion: z.enum(['1', '2c', '3']).optional(),
  
  // HTTP configuration
  httpEndpoint: z.string().url().optional().nullable(),
  httpExpectedCode: z.number().min(100).max(599).optional(),
  
  // Visual customization
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional().nullable(),
  
  // Status (can be manually set)
  status: StatusEnum.optional(),
  internetStatus: StatusEnum.optional(),
});

export type CreateNodeInput = z.infer<typeof CreateNodeSchema>;
export type UpdateNodeInput = z.infer<typeof UpdateNodeSchema>;

// ============================================
// Connection Schemas
// ============================================

export const CreateConnectionSchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  label: z.string().optional(),
  bandwidth: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6B7280'),
  animated: z.boolean().optional().default(true),
});

export const UpdateConnectionSchema = z.object({
  label: z.string().optional().nullable(),
  bandwidth: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  animated: z.boolean().optional(),
});

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;

// ============================================
// Probe Status Schemas
// ============================================

export const ProbeStatusMessageSchema = z.object({
  nodeId: z.string(),
  status: StatusEnum,
  latency: z.number().optional(),
  internetStatus: StatusEnum.optional(),
  message: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export type ProbeStatusMessage = z.infer<typeof ProbeStatusMessageSchema>;

// ============================================
// WebSocket Message Types
// ============================================

export interface WSMessage {
  type: 'NODE_STATUS_UPDATE' | 'NODE_CREATED' | 'NODE_UPDATED' | 'NODE_DELETED' |
        'CONNECTION_CREATED' | 'CONNECTION_DELETED' | 'NETWORK_UPDATE' | 'PING';
  payload: unknown;
  timestamp: string;
}

export interface NodeStatusUpdatePayload {
  nodeId: string;
  status: Status;
  internetStatus?: Status;
  latency?: number;
  lastSeen: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface NetworkTopology {
  nodes: NodeWithConnections[];
  connections: ConnectionWithNodes[];
}

export interface NodeWithConnections {
  id: string;
  name: string;
  type: NodeType;
  description: string | null;
  positionX: number;
  positionY: number;
  
  // Monitoring configuration
  monitoringMethod: MonitoringMethod;
  ipAddress: string | null;
  pingInterval: number;
  mqttTopic: string | null;
  snmpCommunity: string | null;
  snmpVersion: string;
  httpEndpoint: string | null;
  httpExpectedCode: number;
  
  // Status
  status: Status;
  lastSeen: Date | null;
  latency: number | null;
  internetStatus: Status;
  internetLastCheck: Date | null;
  
  // Visual
  color: string;
  icon: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionWithNodes {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  bandwidth: string | null;
  color: string;
  animated: boolean;
  createdAt: Date;
  updatedAt: Date;
}




