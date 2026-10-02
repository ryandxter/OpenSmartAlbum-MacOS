import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react';
import { StudioLayer } from './types';
import { LayerThumbnail } from './LayerThumbnail';
import styles from './LayerCard.module.css';

export interface LayerCardProps {
  layer: StudioLayer;
  index: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isDragging: boolean;
  onSelect: (e: React.MouseEvent, layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onRename: (layerId: string, newName: string) => void;
  onDelete: (layerId: string) => void;
  // Drag-and-drop wiring
  onDragStartHandle?: (e: React.DragEvent<HTMLDivElement>, layerId: string) => void;
  onDragOverHandle?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
}

export const LayerCard: React.FC<LayerCardProps> = React.memo(({
  layer,
  index,
  isSelected,
  isMultiSelected,
  isDragging,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onDelete,
  onDragStartHandle,
  onDragOverHandle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name || layer.defaultTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(layer.name || layer.defaultTitle);
  }, [layer.name, layer.defaultTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!layer.locked) {
      setIsEditing(true);
    }
  };

  const handleCommitRename = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== (layer.name || layer.defaultTitle)) {
      onRename(layer.id, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommitRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(layer.name || layer.defaultTitle);
    }
  };

  // Strict Click Propagation Isolation Protocol
  const handleQuickAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    action();
  };

  const cardClasses = [
    styles.card,
    isSelected ? styles.selected : '',
    isMultiSelected ? styles.multiSelected : '',
    isDragging ? styles.dragging : '',
    layer.hidden ? styles.hiddenState : '',
    layer.locked ? styles.lockedState : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      role="option"
      id={`layer-card-${layer.id}`}
      aria-selected={isSelected}
      aria-label={`${layer.name || layer.defaultTitle}, ${layer.subtitle}`}
      className={cardClasses}
      onClick={(e) => onSelect(e, layer.id)}
      onDoubleClick={handleDoubleClick}
      draggable={!isEditing && !layer.locked}
      onDragStart={(e) => onDragStartHandle && onDragStartHandle(e, layer.id)}
      onDragOver={(e) => onDragOverHandle && onDragOverHandle(e, index)}
    >
      {/* 1. Drag Grip */}
      <span
        className={styles.dragGrip}
        aria-hidden="true"
        title={layer.locked ? 'Layer is locked' : 'Drag to reorder'}
      >
        <GripVertical size={13} />
      </span>

      {/* 2. Thumbnail */}
      <LayerThumbnail layer={layer} />

      {/* 3. Label & Metadata Column */}
      <div className={styles.infoCol}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className={styles.renameInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.layerTitle} title={layer.name || layer.defaultTitle}>
              {layer.name || layer.defaultTitle}
            </span>
            {layer.excludeFromAdaptiveLayout && (
              <span className={styles.excBadge} title="Excluded from adaptive layout reflow">
                EXC
              </span>
            )}
          </div>
        )}
        <span className={styles.layerSubtitle}>{layer.subtitle}</span>
      </div>

      {/* 4. Isolated Quick Actions Strip */}
      <div
        className={styles.quickActions}
        role="toolbar"
        aria-label="Layer quick actions"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Visibility Toggle */}
        <button
          type="button"
          className={`${styles.actionBtn} ${layer.hidden ? styles.actionActive : ''}`}
          title={layer.hidden ? 'Show layer (Cmd+Shift+H)' : 'Hide layer (Cmd+Shift+H)'}
          onClick={(e) => handleQuickAction(e, () => onToggleVisibility(layer.id))}
          aria-label={layer.hidden ? 'Show layer' : 'Hide layer'}
        >
          {layer.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>

        {/* Lock Toggle */}
        <button
          type="button"
          className={`${styles.actionBtn} ${layer.locked ? styles.lockActive : ''}`}
          title={layer.locked ? 'Unlock layer (Cmd+L)' : 'Lock layer (Cmd+L)'}
          onClick={(e) => handleQuickAction(e, () => onToggleLock(layer.id))}
          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
        >
          {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.deleteBtn}`}
          title="Delete layer (Delete)"
          onClick={(e) => handleQuickAction(e, () => onDelete(layer.id))}
          aria-label="Delete layer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
});

LayerCard.displayName = 'LayerCard';
