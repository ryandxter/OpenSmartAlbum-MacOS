import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'open_inspector_sections';
const DEFAULT_SECTIONS = ['layout', 'shapes', 'typography', 'effects'];

export function useAccordionState(initialSections: string[] = DEFAULT_SECTIONS) {
  const [openSections, setOpenSections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fall back to initial sections if localStorage fails
    }
    return initialSections;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      // Ignore storage errors
    }
  }, [openSections]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const isOpen = useCallback(
    (id: string) => openSections.includes(id),
    [openSections]
  );

  const expandAll = useCallback((sectionIds: string[] = DEFAULT_SECTIONS) => {
    setOpenSections(sectionIds);
  }, []);

  const collapseAll = useCallback(() => {
    setOpenSections([]);
  }, []);

  return {
    openSections,
    toggleSection,
    isOpen,
    expandAll,
    collapseAll,
  };
}
