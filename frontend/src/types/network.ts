// Network node types
export type NodeType = 'PROBE' | 'ROUTER' | 'SWITCH' | 'SERVER' | 'GATEWAY' | 'ACCESS_POINT' | 'FIREWALL' | 'VIRTUAL' | 'INTERNET' | 'MAIN_LINK';

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
  
  // Group assignment
  groupId: string | null;
  
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
  
  // ISP configuration (for INTERNET nodes)
  ispName: string | null;
  ispOrganization: string | null;
  
  // Internet access checking
  checkInternetAccess: boolean;
  
  // Visual
  color: string;
  icon: string | null;
  
  createdAt: string;
  updatedAt: string;
}

// Node group - visual grouping zone for organizing nodes
export interface NodeGroup {
  id: string;
  name: string;
  description: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  zIndex: number;
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
  isActiveSource: boolean;
  color: string;
  animated: boolean;
  createdAt: string;
  updatedAt: string;
}

// Connection between groups (inter-area/department links)
export interface GroupConnection {
  id: string;
  sourceGroupId: string;
  targetGroupId: string;
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
  groups: NodeGroup[];
  groupConnections: GroupConnection[];
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
  
  // Group assignment
  groupId?: string | null;
  
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
  
  // ISP configuration (for INTERNET nodes)
  ispName?: string | null;
  ispOrganization?: string | null;
  
  // Internet access checking
  checkInternetAccess?: boolean;
  
  // Status
  status?: Status;
  internetStatus?: Status;
}

// Group DTOs
export interface CreateGroupDTO {
  name: string;
  description?: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  zIndex?: number;
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string | null;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  zIndex?: number;
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

// Group Connection DTOs
export interface CreateGroupConnectionDTO {
  sourceGroupId: string;
  targetGroupId: string;
  label?: string;
  bandwidth?: string;
  color?: string;
  animated?: boolean;
}

export interface UpdateGroupConnectionDTO {
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
  | 'BATCH_STATUS_UPDATE'
  | 'NODE_CREATED'
  | 'NODE_UPDATED'
  | 'NODE_DELETED'
  | 'CONNECTION_CREATED'
  | 'CONNECTION_DELETED'
  | 'CONNECTION_ACTIVE_SOURCE_CHANGED'
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'GROUP_DELETED'
  | 'GROUP_CONNECTION_CREATED'
  | 'GROUP_CONNECTION_DELETED'
  | 'NODE_GROUP_CHANGED'
  | 'NETWORK_UPDATE'
  | 'ISP_DETECTED'
  | 'PING';

// ISP Information
export interface IspInfo {
  publicIp: string;
  isp: string;
  org: string;
  as: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  matchedNodeId?: string | null;
  matchedNodeName?: string | null;
}

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: string;
}

export interface NodeStatusUpdatePayload {
  nodeId: string;
  status?: Status;
  internetStatus?: Status;
  latency?: number | null;
  lastSeen?: string;
  internetLastCheck?: string;
}

// Batched status updates - more efficient for monitoring cycles
export interface BatchStatusUpdatePayload {
  updates: NodeStatusUpdatePayload[];
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
export type EditorMode = 'select' | 'add' | 'connect' | 'connectGroups' | 'delete' | 'group';

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
  INTERNET: 'cloud',
  MAIN_LINK: 'network',
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
  INTERNET: '#00bfff',   // Deep sky blue - represents external cloud/internet
  MAIN_LINK: '#ffd700',  // Gold - represents main entry point
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
  INTERNET: 'Internet',
  MAIN_LINK: 'Main Link',
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
  INTERNET: 'NONE',    // Internet nodes use special external ping check
  MAIN_LINK: 'PING',   // Main link nodes can be pinged locally
};

// Preset group colors for selection
export const GROUP_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];




