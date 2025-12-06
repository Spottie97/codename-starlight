import { useState, useEffect } from 'react';
import { X, Save, Trash2, Users } from 'lucide-react';
import { useNetworkStore, selectSelectedGroup, selectNodes } from '../../store/networkStore';
import { groupsApi } from '../../services/api';
import { cn } from '../../lib/utils';
import type { UpdateGroupDTO } from '../../types/network';
import { GROUP_COLORS } from '../../types/network';

interface FormData {
  name: string;
  description: string;
  color: string;
  opacity: number;
}

export function GroupEditor() {
  const selectedGroup = useNetworkStore(selectSelectedGroup);
  const nodes = useNetworkStore(selectNodes);
  const { setSelectedGroup, updateGroup, removeGroup } = useNetworkStore();
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    color: '#3b82f6',
    opacity: 0.15,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Count nodes in this group
  const nodesInGroup = selectedGroup 
    ? nodes.filter(n => n.groupId === selectedGroup.id)
    : [];

  // Sync form with selected group
  useEffect(() => {
    if (selectedGroup) {
      setFormData({
        name: selectedGroup.name,
        description: selectedGroup.description || '',
        color: selectedGroup.color,
        opacity: selectedGroup.opacity,
      });
    }
  }, [selectedGroup]);

  if (!selectedGroup) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: UpdateGroupDTO = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        opacity: formData.opacity,
      };

      const response = await groupsApi.update(selectedGroup.id, updates);
      
      if (response.success && response.data) {
        updateGroup(selectedGroup.id, response.data);
        setSelectedGroup(null);
      } else {
        console.error('Save failed:', response.error);
      }
    } catch (error) {
      console.error('Failed to save group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete group "${selectedGroup.name}"? Nodes inside will be kept but unassigned.`)) return;
    
    try {
      const response = await groupsApi.delete(selectedGroup.id);
      if (response.success) {
        removeGroup(selectedGroup.id);
        setSelectedGroup(null);
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-[500px] px-4 md:px-0">
      <div className="glass-dark rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: selectedGroup.color }}
            />
            <h3 className="font-display text-lg font-semibold text-white">
              Edit Group Zone
            </h3>
          </div>
          
          <button
            onClick={() => setSelectedGroup(null)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-dark-900/50 text-sm">
          <span className="flex items-center gap-1.5 text-gray-400">
            <Users size={14} />
            {nodesInGroup.length} nodes in group
          </span>
          <span className="text-gray-500 ml-auto text-xs">
            {Math.round(selectedGroup.width)} × {Math.round(selectedGroup.height)} px
          </span>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-cyber"
              placeholder="e.g., Server Room, Building A, Finance Dept"
            />
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

          {/* Color & Opacity Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Color */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Zone Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                />
                <div className="flex gap-1 flex-wrap">
                  {GROUP_COLORS.slice(0, 6).map((color) => (
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

            {/* Opacity */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Fill Opacity: {Math.round(formData.opacity * 100)}%
              </label>
              <input
                type="range"
                min={5}
                max={50}
                value={formData.opacity * 100}
                onChange={(e) => setFormData({ ...formData, opacity: parseInt(e.target.value) / 100 })}
                className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-neon-blue"
              />
            </div>
          </div>

          {/* Nodes in Group */}
          {nodesInGroup.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                Nodes in this group
              </label>
              <div className="flex flex-wrap gap-1.5">
                {nodesInGroup.map((node) => (
                  <span
                    key={node.id}
                    className="px-2 py-1 text-xs bg-dark-600 rounded border border-dark-500"
                    style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
                  >
                    {node.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 bg-dark-900/30">
          <button
            onClick={handleDelete}
            className="btn-cyber-danger text-sm"
          >
            <Trash2 size={16} className="inline mr-2" />
            Delete Group
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


