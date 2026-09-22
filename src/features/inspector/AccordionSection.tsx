import { ReactNode } from 'react';
import { LucideIcon, ChevronDown } from 'lucide-react';
import styles from './AccordionSection.module.css';

export interface AccordionSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  children: ReactNode;
}

export function AccordionSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  badge,
  children,
}: AccordionSectionProps) {
  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Icon size={14} strokeWidth={1.5} />
          </div>
          <span className={styles.headerTitle}>{title}</span>
        </div>

        <div className={styles.headerRight}>
          {badge && <div className={styles.badge}>{badge}</div>}
          <div className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
            <ChevronDown size={14} strokeWidth={1.5} />
          </div>
        </div>
      </button>

      <div className={`${styles.contentGrid} ${isOpen ? styles.contentGridOpen : ''}`}>
        <div className={styles.innerContent}>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </div>
  );
}
