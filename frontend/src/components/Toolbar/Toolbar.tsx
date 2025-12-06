import { useState } from 'react';
import { 
  MousePointer2, 
  Plus, 
  Link2, 
  Share2,
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Save,
  Square,
  LayoutGrid,
  Loader2,
  Check
} from 'lucide-react';
import { useNetworkStore, selectEditorMode, selectCanvasState } from '../../store/networkStore';
import { cn } from '../../lib/utils';
import { networkApi } from '../../services/api';
import type { EditorMode } from '../../types/network';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

function ToolButton({ icon, label, active, onClick, variant = 'default', disabled }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={cn(
        'p-2.5 rounded transition-all duration-200',
        'hover:bg-dark-600',
        active && variant === 'default' && 'bg-neon-blue/20 text-neon-blue shadow-glow',
        active && variant === 'danger' && 'bg-neon-pink/20 text-neon-pink',
        !active && 'text-gray-400 hover:text-white',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {icon}
    </button>
  );
}

export function Toolbar() {
  const editorMode = useNetworkStore(selectEditorMode);
  const canvas = useNetworkStore(selectCanvasState);
  const { setEditorMode, setCanvasScale, resetCanvas, autoArrangeLayout } = useNetworkStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const tools: { mode: EditorMode; icon: React.ReactNode; label: string; variant?: 'default' | 'danger' }[] = [
    { mode: 'select', icon: <MousePointer2 size={20} />, label: 'Select (V)' },
    { mode: 'add', icon: <Plus size={20} />, label: 'Add Node (A)' },
    { mode: 'group', icon: <Square size={20} />, label: 'Add Group Zone (G)' },
    { mode: 'connect', icon: <Link2 size={20} />, label: 'Connect Nodes (C)' },
    { mode: 'connectGroups', icon: <Share2 size={20} />, label: 'Connect Groups (Shift+C)' },
    { mode: 'delete', icon: <Trash2 size={20} />, label: 'Delete (D)', variant: 'danger' },
  ];

  const handleZoomIn = () => setCanvasScale(canvas.scale * 1.2);
  const handleZoomOut = () => setCanvasScale(canvas.scale / 1.2);
  const handleResetView = () => resetCanvas();

  const handleSaveLayout = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const name = `Layout - ${timestamp}`;
      
      const result = await networkApi.saveLayout(name, undefined, true);
      
      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        console.error('Failed to save layout:', result.error);
      }
    } catch (error) {
      console.error('Error saving layout:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute top-20 left-4 z-40 flex flex-col gap-2 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
      {/* Mode Tools */}
      <div className="glass-dark rounded-lg p-1 flex flex-col gap-1">
        {tools.map((tool) => (
          <ToolButton
            key={tool.mode}
            icon={tool.icon}
            label={tool.label}
            active={editorMode === tool.mode}
            onClick={() => setEditorMode(tool.mode)}
            variant={tool.variant}
          />
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="glass-dark rounded-lg p-1 flex flex-col gap-1">
        <ToolButton
          icon={<ZoomIn size={20} />}
          label="Zoom In"
          onClick={handleZoomIn}
        />
        <ToolButton
          icon={<ZoomOut size={20} />}
          label="Zoom Out"
          onClick={handleZoomOut}
        />
        <ToolButton
          icon={<Maximize2 size={20} />}
          label="Reset View"
          onClick={handleResetView}
        />
        <div className="text-center text-xs text-gray-500 py-1">
          {Math.round(canvas.scale * 100)}%
        </div>
      </div>

      {/* Layout */}
      <div className="glass-dark rounded-lg p-1 flex flex-col gap-1">
        <ToolButton
          icon={<LayoutGrid size={20} />}
          label="Auto Arrange Layout"
          onClick={() => autoArrangeLayout()}
        />
      </div>

      {/* Save */}
      <div className="glass-dark rounded-lg p-1 flex flex-col gap-1">
        <ToolButton
          icon={
            isSaving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : saveSuccess ? (
              <Check size={20} className="text-green-500" />
            ) : (
              <Save size={20} />
            )
          }
          label={isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Layout"}
          onClick={handleSaveLayout}
          disabled={isSaving}
          active={saveSuccess}
        />
      </div>
    </div>
  );
}
