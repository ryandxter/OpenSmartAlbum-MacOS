import { Type } from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { TypographyPanel } from '../../editor/TypographyPanel';
import { TextNodeElement } from '../../../domain/text';
import { getAllAlbumSpreads } from '../../../domain/album';
import styles from '../InspectorShared.module.css';

interface TypographySectionProps {
  onToast?: (msg: string) => void;
}

export function TypographySection({ onToast }: TypographySectionProps) {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const addTextToSpread = useEditorStore((s) => s.addTextToSpread);
  const setEditingTextElementId = useEditorStore((s) => s.setEditingTextElementId);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const selectedElements = (activeSpread?.elements || []).filter((el) =>
    selectedFrameIds.includes(el.id)
  );

  const textElement = selectedElements.find((el) => el.type === 'text') as
    | TextNodeElement
    | undefined;

  if (!textElement) {
    return (
      <div>
        <div className={styles.emptyHint}>
          No text frame selected. Select an existing text box or add a new one to format fonts, size, and styling.
        </div>
        <button
          type="button"
          className={styles.actionBtn}
          style={{ marginTop: '4px' }}
          onClick={() => {
            if (!activeSpreadId) return;
            const newId = addTextToSpread(activeSpreadId);
            if (newId) {
              setEditingTextElementId(newId);
              onToast?.('✓ Added Text Box. Type or double-click to edit.');
            }
          }}
        >
          <Type size={13} strokeWidth={1.5} />
          <span>Add Text Box to Spread</span>
        </button>
      </div>
    );
  }

  return <TypographyPanel element={textElement} onToast={onToast} />;
}
