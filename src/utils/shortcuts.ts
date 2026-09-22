import { isMac } from './platform';

export interface ShortcutDefinition {
  ctrlOrCmd?: boolean;
  altOrOption?: boolean;
  shift?: boolean;
  key: string;
}

export function formatShortcut(shortcut: ShortcutDefinition): string {
  const mac = isMac();
  const parts: string[] = [];

  if (mac) {
    if (shortcut.ctrlOrCmd) parts.push('⌘');
    if (shortcut.altOrOption) parts.push('⌥');
    if (shortcut.shift) parts.push('⇧');
    
    // Formatting standard key labels on Mac
    const keyUpper = shortcut.key.toUpperCase();
    if (keyUpper === 'BACKSPACE' || keyUpper === 'DELETE') {
      parts.push('⌫');
    } else if (keyUpper === 'ESCAPE') {
      parts.push('⎋');
    } else {
      parts.push(keyUpper);
    }
    return parts.join('');
  } else {
    if (shortcut.ctrlOrCmd) parts.push('Ctrl');
    if (shortcut.altOrOption) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  }
}

export const SHORTCUTS = {
  UNDO: { ctrlOrCmd: true, key: 'Z' },
  REDO: { ctrlOrCmd: true, shift: true, key: 'Z' },
  SAVE: { ctrlOrCmd: true, key: 'S' },
  EXPORT: { ctrlOrCmd: true, key: 'E' },
  ZOOM_IN: { ctrlOrCmd: true, key: '+' },
  ZOOM_OUT: { ctrlOrCmd: true, key: '-' },
  ZOOM_FIT: { ctrlOrCmd: true, key: '0' },
  ADD_TEXT: { key: 'T' },
  PROPERTIES: { key: 'P' },
  LOCKS: { key: 'L' },
  SMART_LAYOUT: { key: 'G' },
  DELETE: { key: 'Backspace' },
  SELECT_ALL: { ctrlOrCmd: true, key: 'A' },
  DUPLICATE: { ctrlOrCmd: true, key: 'D' },
  GROUP: { ctrlOrCmd: true, key: 'G' },
  UNGROUP: { ctrlOrCmd: true, shift: true, key: 'G' },
} as const;
