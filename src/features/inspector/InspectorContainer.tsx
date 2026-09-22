import { useState, useRef, useEffect } from 'react';
import {
  SlidersHorizontal,
  Wand2,
  Lock,
  ChevronRight,
  Square,
  Type,
  Sparkles,
} from 'lucide-react';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { getAllAlbumSpreads } from '../../domain/album';
import { TemplatesPanel } from '../templates/TemplatesPanel';
import { LockedPhotosPanel } from '../editor/LockedPhotosPanel';
import { AccordionSection } from './AccordionSection';
import { useAccordionState } from './useAccordionState';
import { LayoutSpacingSection } from './sections/LayoutSpacingSection';
import { ShapesBordersSection } from './sections/ShapesBordersSection';
import { TypographySection } from './sections/TypographySection';
import { EffectsShadowsSection } from './sections/EffectsShadowsSection';
import styles from './InspectorContainer.module.css';

export interface InspectorContainerProps {
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export function InspectorContainer({ onClose, onToast }: InspectorContainerProps) {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);

  const [activeTab, setActiveTab] = useState<'properties' | 'smart_layout' | 'locks'>('properties');
  const contentRef = useRef<HTMLDivElement>(null);

  const { isOpen, toggleSection } = useAccordionState([
    'layout',
    'shapes',
    'typography',
    'effects',
  ]);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  const lockCount = (activeSpread?.elements || []).filter((f) => f.locked).length;

  // Auto-scroll to top whenever selection changes in properties tab
  useEffect(() => {
    if (selectedFrameIds.length > 0 && activeTab === 'properties') {
      const timer = setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedFrameIds, activeTab]);

  return (
    <aside className={styles.container} aria-label="Properties Inspector">
      {/* Top Tabs Header */}
      <div className={styles.tabsHeader}>
        <div className={styles.tabButtons} role="tablist" aria-label="Inspector Panels">
          {/* Tab 1: Properties */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'properties'}
            className={`${styles.tabBtn} ${activeTab === 'properties' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('properties')}
            title="Properties (Layout, Shapes, Typography, Effects)"
          >
            <SlidersHorizontal size={15} strokeWidth={1.5} />
          </button>

          {/* Tab 2: Smart Layout */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'smart_layout'}
            className={`${styles.tabBtn} ${activeTab === 'smart_layout' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('smart_layout')}
            title="Smart Layout Templates"
          >
            <Wand2 size={15} strokeWidth={1.5} />
          </button>

          {/* Tab 3: Locked Elements */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'locks'}
            className={`${styles.tabBtn} ${activeTab === 'locks' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('locks')}
            title="Locked Frames Management"
          >
            <Lock size={15} strokeWidth={1.5} />
            {lockCount > 0 && <span className={styles.lockBadge}>{lockCount}</span>}
          </button>
        </div>

        {/* Collapse Button */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          title="Collapse Inspector"
          aria-label="Collapse Inspector"
        >
          <ChevronRight size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Tab Contents */}
      <div className={styles.content} ref={contentRef}>
        {activeTab === 'smart_layout' ? (
          <TemplatesPanel onApplyToast={(msg) => onToast?.(msg)} />
        ) : activeTab === 'locks' ? (
          <LockedPhotosPanel onToast={(msg) => onToast?.(msg)} />
        ) : (
          <div>
            {/* Section 1: Layout & Spacing */}
            <AccordionSection
              id="layout"
              title="Layout & Spacing"
              icon={SlidersHorizontal}
              isOpen={isOpen('layout')}
              onToggle={() => toggleSection('layout')}
            >
              <LayoutSpacingSection onToast={onToast} />
            </AccordionSection>

            {/* Section 2: Shapes & Borders */}
            <AccordionSection
              id="shapes"
              title="Shapes & Borders"
              icon={Square}
              isOpen={isOpen('shapes')}
              onToggle={() => toggleSection('shapes')}
            >
              <ShapesBordersSection onToast={onToast} />
            </AccordionSection>

            {/* Section 3: Typography */}
            <AccordionSection
              id="typography"
              title="Typography"
              icon={Type}
              isOpen={isOpen('typography')}
              onToggle={() => toggleSection('typography')}
            >
              <TypographySection onToast={onToast} />
            </AccordionSection>

            {/* Section 4: Effects & Shadows */}
            <AccordionSection
              id="effects"
              title="Effects & Shadows"
              icon={Sparkles}
              isOpen={isOpen('effects')}
              onToggle={() => toggleSection('effects')}
            >
              <EffectsShadowsSection onToast={onToast} />
            </AccordionSection>
          </div>
        )}
      </div>
    </aside>
  );
}
