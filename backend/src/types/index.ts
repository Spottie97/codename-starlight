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
  'VIRTUAL'
]);

export const StatusEnum = z.enum([
  'ONLINE',
  'OFFLINE',
  'DEGRADED',
  'UNKNOWN'
]);

export type NodeType = z.infer<typeof NodeTypeEnum>;
export type Status = z.infer<typeof StatusEnum>;

// ============================================
// Node Schemas
// ============================================

export const CreateNodeSchema = z.object({
  name: z.string().min(1).max(100),
  type: NodeTypeEnum.optional().default('PROBE'),
  description: z.string().optional(),
  positionX: z.number().optional().default(0),
  positionY: z.number().optional().default(0),
  mqttTopic: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#4F46E5'),
  icon: z.string().optional(),
});

export const UpdateNodeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: NodeTypeEnum.optional(),
  description: z.string().optional().nullable(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  mqttTopic: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional().nullable(),
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
  mqttTopic: string | null;
  status: Status;
  lastSeen: Date | null;
  latency: number | null;
  internetStatus: Status;
  internetLastCheck: Date | null;
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

