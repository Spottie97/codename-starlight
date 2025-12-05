// Network node types
export type NodeType = 'PROBE' | 'ROUTER' | 'SWITCH' | 'SERVER' | 'GATEWAY' | 'ACCESS_POINT' | 'FIREWALL' | 'VIRTUAL';

// Status types
export type Status = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';

// Monitoring method types
export type MonitoringMethod = 'MQTT' | 'PING' | 'SNMP' | 'HTTP' | 'NONE';

// Network node interface
export interface NetworkNode {
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
  lastSeen: string | null;
  latency: number | null;
  internetStatus: Status;
  internetLastCheck: string | null;
  
  // Visual
  color: string;
  icon: string | null;
  
  createdAt: string;
  updatedAt: string;
}

// Connection between nodes
export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  bandwidth: string | null;
  color: string;
  animated: boolean;
  createdAt: string;
  updatedAt: string;
}

// Network topology
export interface NetworkTopology {
  nodes: NetworkNode[];
  connections: Connection[];
}

// Create/Update DTOs
export interface CreateNodeDTO {
  name: string;
  type?: NodeType;
  description?: string;
  positionX?: number;
  positionY?: number;
  
  // Monitoring configuration
  monitoringMethod?: MonitoringMethod;
  ipAddress?: string;
  pingInterval?: number;
  mqttTopic?: string;
  snmpCommunity?: string;
  snmpVersion?: '1' | '2c' | '3';
  httpEndpoint?: string;
  httpExpectedCode?: number;
  
  // Visual
  color?: string;
  icon?: string;
}

export interface UpdateNodeDTO {
  name?: string;
  type?: NodeType;
  description?: string | null;
  positionX?: number;
  positionY?: number;
  
  // Monitoring configuration
  monitoringMethod?: MonitoringMethod;
  ipAddress?: string | null;
  pingInterval?: number;
  mqttTopic?: string | null;
  snmpCommunity?: string | null;
  snmpVersion?: '1' | '2c' | '3';
  httpEndpoint?: string | null;
  httpExpectedCode?: number;
  
  // Visual
  color?: string;
  icon?: string | null;
  
  // Status
  status?: Status;
  internetStatus?: Status;
}

export interface CreateConnectionDTO {
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  bandwidth?: string;
  color?: string;
  animated?: boolean;
}

export interface UpdateConnectionDTO {
  label?: string | null;
  bandwidth?: string | null;
  color?: string;
  animated?: boolean;
}

// Probe status summary
export interface ProbeStatusSummary {
  total: number;
  network: {
    online: number;
    offline: number;
    degraded: number;
    unknown: number;
  };
  internet: {
    online: number;
    offline: number;
    unknown: number;
  };
}

// WebSocket message types
export type WSMessageType = 
  | 'NODE_STATUS_UPDATE'
  | 'NODE_CREATED'
  | 'NODE_UPDATED'
  | 'NODE_DELETED'
  | 'CONNECTION_CREATED'
  | 'CONNECTION_DELETED'
  | 'NETWORK_UPDATE'
  | 'PING';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: string;
}

export interface NodeStatusUpdatePayload {
  nodeId: string;
  status?: Status;
  internetStatus?: Status;
  latency?: number;
  lastSeen?: string;
  internetLastCheck?: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Layout
export interface NetworkLayout {
  id: string;
  name: string;
  description: string | null;
  layoutData: NetworkTopology;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Canvas interaction state
export interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
  isDragging: boolean;
  selectedNodeId: string | null;
  isConnecting: boolean;
  connectingFromId: string | null;
}

// Editor mode
export type EditorMode = 'select' | 'add' | 'connect' | 'delete';

// Node icon mapping
export const NODE_ICONS: Record<NodeType, string> = {
  PROBE: 'radio',
  ROUTER: 'router',
  SWITCH: 'git-branch',
  SERVER: 'server',
  GATEWAY: 'globe',
  ACCESS_POINT: 'wifi',
  FIREWALL: 'shield',
  VIRTUAL: 'box',
};

// Status colors
export const STATUS_COLORS: Record<Status, string> = {
  ONLINE: '#39ff14',
  OFFLINE: '#ff2a6d',
  DEGRADED: '#fffc00',
  UNKNOWN: '#6b7280',
};

// Node type colors (defaults)
export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  PROBE: '#05d9e8',
  ROUTER: '#d300c5',
  SWITCH: '#ff6b35',
  SERVER: '#4F46E5',
  GATEWAY: '#14b8a6',
  ACCESS_POINT: '#8b5cf6',
  FIREWALL: '#ef4444',
  VIRTUAL: '#6b7280',
};

// Monitoring method labels
export const MONITORING_METHOD_LABELS: Record<MonitoringMethod, string> = {
  MQTT: 'MQTT (Push)',
  PING: 'ICMP Ping',
  SNMP: 'SNMP',
  HTTP: 'HTTP Health Check',
  NONE: 'None (Visual Only)',
};

// Node type labels for display
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  PROBE: 'Probe',
  ROUTER: 'Router',
  SWITCH: 'Switch',
  SERVER: 'Server',
  GATEWAY: 'Gateway',
  ACCESS_POINT: 'Access Point',
  FIREWALL: 'Firewall',
  VIRTUAL: 'Virtual',
};

// Default monitoring methods per node type
export const DEFAULT_MONITORING_METHOD: Record<NodeType, MonitoringMethod> = {
  PROBE: 'MQTT',
  ROUTER: 'PING',
  SWITCH: 'PING',
  SERVER: 'PING',
  GATEWAY: 'PING',
  ACCESS_POINT: 'PING',
  FIREWALL: 'PING',
  VIRTUAL: 'NONE',
};




