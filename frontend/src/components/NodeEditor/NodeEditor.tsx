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
  Box
} from 'lucide-react';
import { useNetworkStore, selectSelectedNode } from '../../store/networkStore';
import { nodesApi } from '../../services/api';
import { cn, formatRelativeTime, formatLatency, getStatusBgClass } from '../../lib/utils';
import type { NodeType, UpdateNodeDTO } from '../../types/network';

const NODE_TYPE_OPTIONS: { value: NodeType; label: string; icon: React.ReactNode }[] = [
  { value: 'PROBE', label: 'Probe', icon: <Radio size={16} /> },
  { value: 'ROUTER', label: 'Router', icon: <Router size={16} /> },
  { value: 'SWITCH', label: 'Switch', icon: <GitBranch size={16} /> },
  { value: 'SERVER', label: 'Server', icon: <Server size={16} /> },
  { value: 'GATEWAY', label: 'Gateway', icon: <Globe size={16} /> },
  { value: 'VIRTUAL', label: 'Virtual', icon: <Box size={16} /> },
];

const PRESET_COLORS = [
  '#05d9e8', '#ff2a6d', '#d300c5', '#39ff14', '#fffc00', '#ff6b35',
  '#4F46E5', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'
];

export function NodeEditor() {
  const selectedNode = useNetworkStore(selectSelectedNode);
  const { setSelectedNode, updateNode, removeNode } = useNetworkStore();
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'PROBE' as NodeType,
    description: '',
    mqttTopic: '',
    color: '#05d9e8',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Sync form with selected node
  useEffect(() => {
    if (selectedNode) {
      setFormData({
        name: selectedNode.name,
        type: selectedNode.type,
        description: selectedNode.description || '',
        mqttTopic: selectedNode.mqttTopic || '',
        color: selectedNode.color,
      });
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: UpdateNodeDTO = {
        name: formData.name,
        type: formData.type,
        description: formData.description || null,
        mqttTopic: formData.mqttTopic || null,
        color: formData.color,
      };

      const response = await nodesApi.update(selectedNode.id, updates);
      if (response.success && response.data) {
        updateNode(selectedNode.id, response.data);
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

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[600px] max-w-[calc(100vw-2rem)]">
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
            <span className="text-gray-400">
              Latency: {formatLatency(selectedNode.latency)}
            </span>
          )}
          <span className="text-gray-500 ml-auto">
            Last seen: {formatRelativeTime(selectedNode.lastSeen)}
          </span>
        </div>

        {/* Form */}
        <div className="p-4 grid grid-cols-2 gap-4">
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
              onChange={(e) => setFormData({ ...formData, type: e.target.value as NodeType })}
              className="input-cyber"
            >
              {NODE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* MQTT Topic */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              MQTT Topic
            </label>
            <input
              type="text"
              value={formData.mqttTopic}
              onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
              className="input-cyber"
              placeholder="network/probes/node-id/status"
            />
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
                {PRESET_COLORS.slice(0, 6).map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      'w-6 h-6 rounded transition-transform hover:scale-110',
                      formData.color === color && 'ring-2 ring-white'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="col-span-2">
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




