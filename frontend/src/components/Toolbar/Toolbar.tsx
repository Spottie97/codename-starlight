import { 
  MousePointer2, 
  Plus, 
  Link2, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Save,
  FolderOpen
} from 'lucide-react';
import { useNetworkStore, selectEditorMode, selectCanvasState } from '../../store/networkStore';
import { cn } from '../../lib/utils';
import type { EditorMode } from '../../types/network';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

function ToolButton({ icon, label, active, onClick, variant = 'default' }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'p-2.5 rounded transition-all duration-200',
        'hover:bg-dark-600',
        active && variant === 'default' && 'bg-neon-blue/20 text-neon-blue shadow-glow',
        active && variant === 'danger' && 'bg-neon-pink/20 text-neon-pink',
        !active && 'text-gray-400 hover:text-white',
      )}
    >
      {icon}
    </button>
  );
}

export function Toolbar() {
  const editorMode = useNetworkStore(selectEditorMode);
  const canvas = useNetworkStore(selectCanvasState);
  const { setEditorMode, setCanvasScale, resetCanvas } = useNetworkStore();

  const tools: { mode: EditorMode; icon: React.ReactNode; label: string; variant?: 'default' | 'danger' }[] = [
    { mode: 'select', icon: <MousePointer2 size={20} />, label: 'Select (V)' },
    { mode: 'add', icon: <Plus size={20} />, label: 'Add Node (A)' },
    { mode: 'connect', icon: <Link2 size={20} />, label: 'Connect Nodes (C)' },
    { mode: 'delete', icon: <Trash2 size={20} />, label: 'Delete (D)', variant: 'danger' },
  ];

  const handleZoomIn = () => setCanvasScale(canvas.scale * 1.2);
  const handleZoomOut = () => setCanvasScale(canvas.scale / 1.2);
  const handleResetView = () => resetCanvas();

  return (
    <div className="absolute top-20 left-4 z-40 flex flex-col gap-2">
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

      {/* Save/Load */}
      <div className="glass-dark rounded-lg p-1 flex flex-col gap-1">
        <ToolButton
          icon={<Save size={20} />}
          label="Save Layout"
          onClick={() => {/* TODO: Implement save */}}
        />
        <ToolButton
          icon={<FolderOpen size={20} />}
          label="Load Layout"
          onClick={() => {/* TODO: Implement load */}}
        />
      </div>
    </div>
  );
}

