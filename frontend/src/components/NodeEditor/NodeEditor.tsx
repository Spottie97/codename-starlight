import { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Radio, 
  Server, 
  GitBranch, 
  Globe,
  Router,
  Box,
  Wifi,
  Shield,
  Activity
} from 'lucide-react';
import { useNetworkStore, selectSelectedNode } from '../../store/networkStore';
import { nodesApi } from '../../services/api';
import { cn, formatRelativeTime, formatLatency, getStatusBgClass } from '../../lib/utils';
import type { NodeType, MonitoringMethod, UpdateNodeDTO } from '../../types/network';
import { 
  NODE_TYPE_LABELS, 
  MONITORING_METHOD_LABELS, 
  DEFAULT_MONITORING_METHOD,
  NODE_TYPE_COLORS 
} from '../../types/network';

const NODE_TYPE_OPTIONS: { value: NodeType; label: string; icon: React.ReactNode }[] = [
  { value: 'PROBE', label: 'Probe', icon: <Radio size={16} /> },
  { value: 'ROUTER', label: 'Router', icon: <Router size={16} /> },
  { value: 'SWITCH', label: 'Switch', icon: <GitBranch size={16} /> },
  { value: 'SERVER', label: 'Server', icon: <Server size={16} /> },
  { value: 'GATEWAY', label: 'Gateway', icon: <Globe size={16} /> },
  { value: 'ACCESS_POINT', label: 'Access Point', icon: <Wifi size={16} /> },
  { value: 'FIREWALL', label: 'Firewall', icon: <Shield size={16} /> },
  { value: 'VIRTUAL', label: 'Virtual', icon: <Box size={16} /> },
];

const MONITORING_METHOD_OPTIONS: { value: MonitoringMethod; label: string }[] = [
  { value: 'NONE', label: 'None (Visual Only)' },
  { value: 'MQTT', label: 'MQTT (Push from device)' },
  { value: 'PING', label: 'ICMP Ping' },
  { value: 'SNMP', label: 'SNMP Polling' },
  { value: 'HTTP', label: 'HTTP Health Check' },
];

const PRESET_COLORS = [
  '#05d9e8', '#ff2a6d', '#d300c5', '#39ff14', '#fffc00', '#ff6b35',
  '#4F46E5', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'
];

interface FormData {
  name: string;
  type: NodeType;
  description: string;
  color: string;
  monitoringMethod: MonitoringMethod;
  ipAddress: string;
  pingInterval: number;
  mqttTopic: string;
  snmpCommunity: string;
  snmpVersion: '1' | '2c' | '3';
  httpEndpoint: string;
  httpExpectedCode: number;
}

export function NodeEditor() {
  const selectedNode = useNetworkStore(selectSelectedNode);
  const { setSelectedNode, updateNode, removeNode } = useNetworkStore();
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'PROBE',
    description: '',
    color: '#05d9e8',
    monitoringMethod: 'NONE',
    ipAddress: '',
    pingInterval: 30,
    mqttTopic: '',
    snmpCommunity: 'public',
    snmpVersion: '2c',
    httpEndpoint: '',
    httpExpectedCode: 200,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Sync form with selected node
  useEffect(() => {
    if (selectedNode) {
      setFormData({
        name: selectedNode.name,
        type: selectedNode.type,
        description: selectedNode.description || '',
        color: selectedNode.color,
        monitoringMethod: selectedNode.monitoringMethod || 'NONE',
        ipAddress: selectedNode.ipAddress || '',
        pingInterval: selectedNode.pingInterval || 30,
        mqttTopic: selectedNode.mqttTopic || '',
        snmpCommunity: selectedNode.snmpCommunity || 'public',
        snmpVersion: (selectedNode.snmpVersion as '1' | '2c' | '3') || '2c',
        httpEndpoint: selectedNode.httpEndpoint || '',
        httpExpectedCode: selectedNode.httpExpectedCode || 200,
      });
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  // Handle type change - auto-set default monitoring method
  const handleTypeChange = (newType: NodeType) => {
    const defaultMethod = DEFAULT_MONITORING_METHOD[newType];
    const newColor = NODE_TYPE_COLORS[newType];
    setFormData({ 
      ...formData, 
      type: newType, 
      monitoringMethod: defaultMethod,
      color: newColor,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: UpdateNodeDTO = {
        name: formData.name,
        type: formData.type,
        description: formData.description || null,
        color: formData.color,
        monitoringMethod: formData.monitoringMethod,
        ipAddress: formData.ipAddress || null,
        pingInterval: formData.pingInterval,
        mqttTopic: formData.mqttTopic || null,
        snmpCommunity: formData.snmpCommunity || null,
        snmpVersion: formData.snmpVersion,
        httpEndpoint: formData.httpEndpoint || null,
        httpExpectedCode: formData.httpExpectedCode,
      };

      console.log('Saving node updates:', updates);
      const response = await nodesApi.update(selectedNode.id, updates);
      console.log('Save response:', response);
      
      if (response.success && response.data) {
        updateNode(selectedNode.id, response.data);
        // Close the editor after successful save
        setSelectedNode(null);
      } else {
        console.error('Save failed:', response.error);
      }
    } catch (error) {
      console.error('Failed to save node:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete node "${selectedNode.name}"?`)) return;
    
    try {
      const response = await nodesApi.delete(selectedNode.id);
      if (response.success) {
        removeNode(selectedNode.id);
        setSelectedNode(null);
      }
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  // Determine which monitoring config to show
  const showIpAddress = ['PING', 'SNMP', 'HTTP'].includes(formData.monitoringMethod);
  const showMqttConfig = formData.monitoringMethod === 'MQTT';
  const showSnmpConfig = formData.monitoringMethod === 'SNMP';
  const showHttpConfig = formData.monitoringMethod === 'HTTP';
  const showPingInterval = ['PING', 'SNMP', 'HTTP'].includes(formData.monitoringMethod);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[700px] max-w-[calc(100vw-2rem)]">
      <div className="glass-dark rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedNode.color }}
            />
            <h3 className="font-display text-lg font-semibold text-white">
              Edit Node
            </h3>
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {NODE_TYPE_LABELS[selectedNode.type]}
            </span>
          </div>
          
          <button
            onClick={() => setSelectedNode(null)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-dark-900/50 text-sm">
          <div className={cn(
            'px-2 py-0.5 rounded border text-xs font-semibold uppercase',
            getStatusBgClass(selectedNode.status)
          )}>
            Network: {selectedNode.status}
          </div>
          <div className={cn(
            'px-2 py-0.5 rounded border text-xs font-semibold uppercase',
            getStatusBgClass(selectedNode.internetStatus)
          )}>
            Internet: {selectedNode.internetStatus}
          </div>
          {selectedNode.latency !== null && (
            <span className="text-gray-400 flex items-center gap-1">
              <Activity size={12} />
              {formatLatency(selectedNode.latency)}
            </span>
          )}
          <span className="text-gray-500 text-xs uppercase tracking-wider px-2 py-0.5 bg-dark-600 rounded">
            {MONITORING_METHOD_LABELS[selectedNode.monitoringMethod || 'NONE']}
          </span>
          <span className="text-gray-500 ml-auto">
            Last seen: {formatRelativeTime(selectedNode.lastSeen)}
          </span>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Basic Info Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-cyber"
                placeholder="Node name"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as NodeType)}
                className="input-cyber"
              >
                {NODE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                />
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.slice(0, 5).map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={cn(
                        'w-5 h-5 rounded transition-transform hover:scale-110',
                        formData.color === color && 'ring-2 ring-white'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Monitoring Configuration Section */}
          <div className="border-t border-dark-500 pt-4">
            <h4 className="text-sm font-semibold text-neon-blue mb-3 flex items-center gap-2">
              <Activity size={14} />
              Monitoring Configuration
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Monitoring Method */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                  Method
                </label>
                <select
                  value={formData.monitoringMethod}
                  onChange={(e) => setFormData({ ...formData, monitoringMethod: e.target.value as MonitoringMethod })}
                  className="input-cyber"
                >
                  {MONITORING_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* IP Address */}
              {showIpAddress && (
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                    IP Address / Hostname
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="input-cyber"
                    placeholder="192.168.1.1"
                  />
                </div>
              )}

              {/* Ping Interval */}
              {showPingInterval && (
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                    Check Interval (sec)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={formData.pingInterval}
                    onChange={(e) => setFormData({ ...formData, pingInterval: parseInt(e.target.value) || 30 })}
                    className="input-cyber"
                  />
                </div>
              )}

              {/* MQTT Topic */}
              {showMqttConfig && (
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                    MQTT Topic
                  </label>
                  <input
                    type="text"
                    value={formData.mqttTopic}
                    onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
                    className="input-cyber"
                    placeholder="starlight/probes/{node-id}/status"
                  />
                </div>
              )}

              {/* SNMP Config */}
              {showSnmpConfig && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      SNMP Community
                    </label>
                    <input
                      type="text"
                      value={formData.snmpCommunity}
                      onChange={(e) => setFormData({ ...formData, snmpCommunity: e.target.value })}
                      className="input-cyber"
                      placeholder="public"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      SNMP Version
                    </label>
                    <select
                      value={formData.snmpVersion}
                      onChange={(e) => setFormData({ ...formData, snmpVersion: e.target.value as '1' | '2c' | '3' })}
                      className="input-cyber"
                    >
                      <option value="1">v1</option>
                      <option value="2c">v2c</option>
                      <option value="3">v3</option>
                    </select>
                  </div>
                </>
              )}

              {/* HTTP Config */}
              {showHttpConfig && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      HTTP Endpoint
                    </label>
                    <input
                      type="text"
                      value={formData.httpEndpoint}
                      onChange={(e) => setFormData({ ...formData, httpEndpoint: e.target.value })}
                      className="input-cyber"
                      placeholder="http://192.168.1.1/status"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      Expected Status Code
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={599}
                      value={formData.httpExpectedCode}
                      onChange={(e) => setFormData({ ...formData, httpExpectedCode: parseInt(e.target.value) || 200 })}
                      className="input-cyber"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-cyber"
              placeholder="Optional description..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 bg-dark-900/30">
          <button
            onClick={handleDelete}
            className="btn-cyber-danger text-sm"
          >
            <Trash2 size={16} className="inline mr-2" />
            Delete
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-cyber text-sm"
          >
            <Save size={16} className="inline mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
