import React, { useEffect } from 'react';
import { MousePointer, Hand, Type } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { Tooltip } from '../../components/ui/Tooltip';
import styles from './CanvasToolDock.module.css';

interface CanvasToolDockProps {
  onAddText?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CanvasToolDock({ onAddText, className, style }: CanvasToolDockProps) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setActiveTool('pan');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setActiveTool('text');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  const handleTextClick = () => {
    if (activeTool === 'text' && onAddText) {
      onAddText();
      setActiveTool('select');
    } else {
      setActiveTool('text');
    }
  };

  return (
    <div
      className={`${styles.dock} ${className || ''}`}
      style={style}
      role="toolbar"
      aria-label="Canvas Pointer Tools"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Select Tool (V) */}
      <Tooltip content="Select & Transform (V)" position="right">
        <button
          type="button"
          className={`${styles.toolButton} ${activeTool === 'select' ? styles.toolButtonActive : ''}`}
          onClick={() => setActiveTool('select')}
          aria-label="Select Tool (V)"
          aria-pressed={activeTool === 'select'}
          title="Select & Transform (V)"
        >
          <MousePointer size={16} strokeWidth={1.75} />
        </button>
      </Tooltip>

      {/* 2. Hand / Pan Tool (H) */}
      <Tooltip content="Pan Canvas (H or Hold Space)" position="right">
        <button
          type="button"
          className={`${styles.toolButton} ${activeTool === 'pan' ? styles.toolButtonActive : ''}`}
          onClick={() => setActiveTool('pan')}
          aria-label="Pan Canvas Tool (H)"
          aria-pressed={activeTool === 'pan'}
          title="Pan Canvas (H or Hold Space)"
        >
          <Hand size={16} strokeWidth={1.75} />
        </button>
      </Tooltip>

      {/* 3. Text Tool (T) */}
      <Tooltip content="Add Text Box (T)" position="right">
        <button
          type="button"
          className={`${styles.toolButton} ${activeTool === 'text' ? styles.toolButtonActive : ''}`}
          onClick={handleTextClick}
          aria-label="Text Tool (T)"
          aria-pressed={activeTool === 'text'}
          title="Add Text Box (T)"
        >
          <Type size={16} strokeWidth={1.75} />
        </button>
      </Tooltip>
    </div>
  );
}
