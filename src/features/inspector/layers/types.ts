import type { AlbumElement } from '../../../domain/album';
import type { CarouselElement } from '../../../domain/carousel';

export type LayerKind = 'photo' | 'text' | 'shape';

export interface StudioLayer {
  id: string;
  kind: LayerKind;
  name?: string;
  defaultTitle: string;
  subtitle: string;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  isMissing?: boolean;
  excludeFromAdaptiveLayout?: boolean;
  // Thumbnail specific props
  thumbnailSrc?: string;
  shapeType?: string;
  customSvgPath?: string;
  textSnippet?: string;
  rawElement: AlbumElement | CarouselElement;
}

/**
 * Normalizes an AlbumElement (Print Mode) into a StudioLayer.
 */
export function normalizeAlbumElementToLayer(
  element: AlbumElement,
  index: number,
  _total?: number
): StudioLayer {
  const zIndex = element.zIndex ?? index + 1;
  const isLocked = Boolean(element.locked);
  const isHidden = Boolean(element.hidden);

  if (element.type === 'text') {
    const snippet = element.text ? element.text.trim().slice(0, 30) : '';
    return {
      id: element.id,
      kind: 'text',
      name: element.name,
      defaultTitle: snippet.length > 0 ? `"${snippet}"` : 'Text Block',
      subtitle: `${Math.round(element.width)} × ${Math.round(element.height)} mm · #${zIndex}`,
      zIndex,
      locked: isLocked,
      hidden: isHidden,
      textSnippet: snippet,
      rawElement: element,
    };
  }

  // Photo Frame
  const isShape = Boolean(element.shapeType && element.shapeType !== 'rectangle');
  const fileName = element.fileName || (element.filePath ? element.filePath.split(/[\\/]/).pop() : '') || 'Photo';
  const defaultTitle = isShape
    ? `Mask: ${element.shapeType || 'Custom'}`
    : element.photoId
    ? fileName
    : 'Empty Frame';

  return {
    id: element.id,
    kind: isShape ? 'shape' : 'photo',
    name: element.name,
    defaultTitle,
    subtitle: `${Math.round(element.width)} × ${Math.round(element.height)} mm · #${zIndex}`,
    zIndex,
    locked: isLocked,
    hidden: isHidden,
    isMissing: Boolean(element.isMissing),
    excludeFromAdaptiveLayout: Boolean(element.excludeFromAdaptiveLayout),
    thumbnailSrc: element.thumbnailPath || element.previewPath || element.filePath,
    shapeType: element.shapeType,
    customSvgPath: element.customSvgPath,
    rawElement: element,
  };
}

/**
 * Normalizes a CarouselElement (Social Mode) into a StudioLayer.
 */
export function normalizeCarouselElementToLayer(
  element: CarouselElement,
  index: number,
  _total?: number
): StudioLayer {
  const zIndex = element.zIndex ?? index + 1;
  const isLocked = Boolean(element.locked);
  const isHidden = Boolean(element.hidden);

  if (element.type === 'text') {
    const snippet = element.text ? element.text.trim().slice(0, 30) : '';
    return {
      id: element.id,
      kind: 'text',
      name: element.name,
      defaultTitle: snippet.length > 0 ? `"${snippet}"` : 'Text Node',
      subtitle: `${Math.round(element.width)} × ${Math.round(element.height)} px · #${zIndex}`,
      zIndex,
      locked: isLocked,
      hidden: isHidden,
      textSnippet: snippet,
      rawElement: element,
    };
  }

  // Carousel Photo
  const isShape = Boolean(element.shapeType && element.shapeType !== 'rectangle');
  const fileName = element.fileName || (element.filePath ? element.filePath.split(/[\\/]/).pop() : '') || 'Photo';
  const defaultTitle = isShape
    ? `Mask: ${element.shapeType || 'Custom'}`
    : element.photoId || element.filePath
    ? fileName
    : 'Empty Photo';

  return {
    id: element.id,
    kind: isShape ? 'shape' : 'photo',
    name: element.name,
    defaultTitle,
    subtitle: `${Math.round(element.width)} × ${Math.round(element.height)} px · #${zIndex}`,
    zIndex,
    locked: isLocked,
    hidden: isHidden,
    isMissing: Boolean(element.isMissing),
    excludeFromAdaptiveLayout: Boolean(element.excludeFromAdaptiveLayout),
    thumbnailSrc: element.thumbnailPath || element.previewPath || element.filePath,
    shapeType: element.shapeType,
    customSvgPath: element.customSvgPath,
    rawElement: element,
  };
}
