import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  secondaryText?: string;
  onSecondary?: () => void | Promise<void>;
  secondaryVariant?: 'ghost' | 'danger' | 'secondary';
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  loadingText?: string;
  error?: string | null;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  detail,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  secondaryText,
  onSecondary,
  secondaryVariant = 'ghost',
  variant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
  loadingText = 'Processing...',
  error,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus cancel button by default for safety
      setTimeout(() => cancelBtnRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
          onCancel();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    if (variant === 'danger') {
      return (
        <div className={`${styles.iconWrapper} ${styles.iconDanger}`}>
          <Trash2 size={22} strokeWidth={1.5} />
        </div>
      );
    }
    if (variant === 'warning') {
      return (
        <div className={`${styles.iconWrapper} ${styles.iconWarning}`}>
          <AlertTriangle size={22} strokeWidth={1.5} />
        </div>
      );
    }
    return (
      <div className={`${styles.iconWrapper} ${styles.iconInfo}`}>
        <Info size={22} strokeWidth={1.5} />
      </div>
    );
  };

  return createPortal(
    <div className={styles.overlay} onClick={() => { if (!isLoading) onCancel(); }}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        aria-busy={isLoading}
      >
        <div className={styles.contentRow}>
          {renderIcon()}
          <div className={styles.textContent}>
            <h3 id="confirm-title" className={styles.title}>{title}</h3>
            <p id="confirm-desc" className={styles.message}>{message}</p>
            {detail && <div className={styles.detailBox}>{detail}</div>}
            {isLoading && <p role="status" aria-live="polite">{loadingText}</p>}
            {error && <p role="alert">{error}</p>}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            ref={cancelBtnRef}
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>

          {secondaryText && onSecondary && (
            <Button
              variant={secondaryVariant}
              onClick={onSecondary}
              disabled={isLoading}
            >
              {secondaryText}
            </Button>
          )}

          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? loadingText : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
