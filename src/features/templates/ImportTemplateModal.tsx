import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { useTemplateStore } from '../../stores/templateStore';
import styles from './ImportTemplateModal.module.css';

interface ImportTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function ImportTemplateModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportTemplateModalProps) {
  const stagedImport = useTemplateStore((s) => s.stagedImport);
  const executeImport = useTemplateStore((s) => s.executeImport);
  const cancelImport = useTemplateStore((s) => s.cancelImport);

  const [resolution, setResolution] = useState<'overwrite' | 'keep_both'>('keep_both');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !stagedImport) return null;

  const hasConflicts = stagedImport.conflicts && stagedImport.conflicts.length > 0;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await executeImport(stagedImport.token, resolution);
      onSuccess?.(`Successfully imported ${stagedImport.templates.length} template${stagedImport.templates.length > 1 ? 's' : ''}`);
      onClose();
    } catch (err) {
      console.error('[ImportTemplateModal] Import execution failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await cancelImport(stagedImport.token);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h3 className={styles.title}>Import Custom Templates</h3>
            <p className={styles.subtitle}>Review template package contents before adding to your library</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleCancel} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Package Info */}
          <div className={styles.pkgInfoBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={16} color="#38bdf8" />
              <span className={styles.pkgName}>{stagedImport.packageName || 'Template Package'}</span>
            </div>
            <span className={styles.templateCountBadge}>
              {stagedImport.templates.length} {stagedImport.templates.length === 1 ? 'Template' : 'Templates'}
            </span>
          </div>

          {/* Template List */}
          <div>
            <h4 className={styles.sectionTitle}>Included Templates</h4>
            <div className={styles.templateList}>
              {stagedImport.templates.map((tpl) => (
                <div key={tpl.id} className={styles.templateItem}>
                  <span className={styles.templateItemName}>{tpl.name}</span>
                  <span className={styles.templateItemMeta}>
                    {tpl.slotCount} {tpl.slotCount === 1 ? 'slot' : 'slots'} · {tpl.canvasKind}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Conflict Section */}
          {hasConflicts && (
            <div className={styles.conflictBox}>
              <div className={styles.conflictWarning}>
                <AlertTriangle size={15} />
                <span>Duplicate Template Detected ({stagedImport.conflicts.length})</span>
              </div>
              <p className={styles.conflictDescription}>
                One or more templates have matching names or identifiers with templates already in your library. Choose how to resolve conflicts:
              </p>
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="conflictResolution"
                    value="keep_both"
                    checked={resolution === 'keep_both'}
                    onChange={() => setResolution('keep_both')}
                  />
                  <span><strong>Import & Keep Both</strong> (renames incoming template with duplicate suffix)</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="conflictResolution"
                    value="overwrite"
                    checked={resolution === 'overwrite'}
                    onChange={() => setResolution('overwrite')}
                  />
                  <span><strong>Overwrite Existing</strong> (replaces existing template in your library)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnCancel} onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className={styles.btnImport} onClick={handleConfirm} disabled={isSubmitting}>
            <CheckCircle size={14} />
            <span>{isSubmitting ? 'Importing...' : 'Import Templates'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
