// Free-asset providers for the Open Library tab (Fase 2 spike).
//
// Lanes proven in the 12 Nov 2026 research + AAS debate, restricted by the
// maintainer's cost rule: keyless only — no paid APIs, no operated proxy.
// - Icons: Iconify public API (already wired via the Rust
//   `search_open_library_assets` command). Results are filtered here to
//   icon sets whose license is permissive (MIT / ISC / Apache-2.0), because
//   Iconify also indexes CC BY, CC BY-SA, GPL and brand-logo sets.
// - Photos: Openverse anonymous API via the Rust
//   `search_openverse_photos` command (the webview fetch path failed at
//   network level — "Load failed" — while the Rust lane worked),
//   filtered to CC0 / Public Domain so the default mode stays
//   "100% free, no attribution required".
//
// Every search result carries an AssetLicenseInfo. A session registry
// keyed by asset id keeps the license attached even after the Rust
// download step replaces the search metadata with its own synthetic
// record, so the inserted canvas element can carry the license with it.

import type { AssetLicenseInfo } from '../domain/editor';
import {
  frameAssetService,
  type FrameAssetMeta,
  type OpenverseSearchResponse,
} from './frameAssetService';

interface IconSetLicense {
  licenseId: string;
  licenseName: string;
  licenseUrl: string;
  setName: string;
}

/**
 * Allowlist of Iconify prefixes whose set license permits use inside
 * distributed designs without attribution obligations in the output.
 * Deliberately small and conservative — extend only with a verified
 * license source. NOTABLE EXCLUSIONS: openmoji (CC BY-SA), twemoji
 * (CC BY), simple-icons (CC0 but brand trademarks), solar/streamline
 * (custom/proprietary terms).
 */
export const PERMISSIVE_ICON_SETS: Record<string, IconSetLicense> = {
  tabler: {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/tabler/tabler-icons/blob/main/LICENSE',
    setName: 'Tabler Icons',
  },
  lucide: {
    licenseId: 'isc',
    licenseName: 'ISC License',
    licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    setName: 'Lucide',
  },
  heroicons: {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/tailwindlabs/heroicons/blob/master/LICENSE',
    setName: 'Heroicons',
  },
  'material-symbols': {
    licenseId: 'apache-2.0',
    licenseName: 'Apache License 2.0',
    licenseUrl: 'https://github.com/google/material-design-icons/blob/master/LICENSE',
    setName: 'Material Symbols',
  },
  mdi: {
    licenseId: 'apache-2.0',
    licenseName: 'Apache License 2.0',
    licenseUrl: 'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE',
    setName: 'Material Design Icons',
  },
  ph: {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/phosphor-icons/core/blob/main/LICENSE',
    setName: 'Phosphor',
  },
  // NOTE: Remix Icon ('ri') is deliberately NOT listed — upstream replaced
  // Apache-2.0 with the custom Remix Icon License v1.0 (2026), which is
  // not an OSI license. Re-add only under its real license id if wanted.
  octicon: {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/primer/octicons/blob/main/LICENSE',
    setName: 'Octicons',
  },
  noto: {
    licenseId: 'apache-2.0',
    licenseName: 'Apache License 2.0',
    licenseUrl: 'https://github.com/googlefonts/noto-emoji/blob/main/LICENSE',
    setName: 'Noto Emoji',
  },
  'fluent-emoji': {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE',
    setName: 'Fluent Emoji',
  },
  'fluent-emoji-flat': {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE',
    setName: 'Fluent Emoji Flat',
  },
  'fluent-emoji-high-contrast': {
    licenseId: 'mit',
    licenseName: 'MIT License',
    licenseUrl: 'https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE',
    setName: 'Fluent Emoji High Contrast',
  },
};

const licenseRegistry = new Map<string, AssetLicenseInfo>();

export function registerFreeAssetLicense(assetId: string, license: AssetLicenseInfo): void {
  licenseRegistry.set(assetId, license);
}

/**
 * License for an asset about to be inserted: prefer the license riding on
 * the (possibly download-replaced) meta, fall back to the search-time
 * registry entry for the same asset id.
 */
export function resolveAssetLicense(asset: FrameAssetMeta): AssetLicenseInfo | null {
  if (asset.license) return asset.license;
  return licenseRegistry.get(asset.id) ?? null;
}

/**
 * Filter Rust Iconify search results to permissive sets and attach +
 * register each survivor's license. Asset ids look like
 * `openlib-{prefix}-{name}` (name itself may contain dashes).
 */
// Longest-first so hyphenated prefixes ('material-symbols',
// 'fluent-emoji-flat', ...) win over any shorter accidental match.
const PERMISSIVE_PREFIXES_LONGEST_FIRST = Object.keys(PERMISSIVE_ICON_SETS).sort(
  (a, b) => b.length - a.length,
);

export function enrichIconifyResults(results: FrameAssetMeta[]): FrameAssetMeta[] {
  const kept: FrameAssetMeta[] = [];
  for (const meta of results) {
    if (!meta.id.startsWith('openlib-')) continue;
    const rest = meta.id.slice('openlib-'.length);
    const prefix = PERMISSIVE_PREFIXES_LONGEST_FIRST.find(
      (p) => rest === p || rest.startsWith(`${p}-`),
    );
    if (!prefix) continue;
    const setLicense = PERMISSIVE_ICON_SETS[prefix]!;
    const license: AssetLicenseInfo = {
      provider: 'iconify',
      licenseId: setLicense.licenseId,
      licenseName: setLicense.licenseName,
      licenseUrl: setLicense.licenseUrl,
      creator: setLicense.setName,
      sourceUrl: `https://icon-sets.iconify.design/${prefix}/`,
      attributionRequired: false,
      attributionText: '',
    };
    registerFreeAssetLicense(meta.id, license);
    kept.push({ ...meta, license });
  }
  return kept;
}

/**
 * Search Openverse for CC0 / Public Domain photos (anonymous tier:
 * 20 req/min, 200 req/day per IP — fine for interactive picking).
 * Transport is the Rust `search_openverse_photos` command: the
 * webview fetch path failed at network level on the maintainer's Mac
 * while the Rust ureq lane (same one Iconify search uses) worked.
 * One automatic retry: the Openverse edge occasionally answers 504.
 * Failures propagate with the Rust side's precise message so the
 * panel can show the real cause.
 */
export async function searchOpenversePhotos(query: string, limit = 24): Promise<FrameAssetMeta[]> {
  let data: OpenverseSearchResponse | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    try {
      data = await frameAssetService.searchOpenverse(query, limit);
    } catch (err) {
      lastError = err;
    }
  }
  if (!data) {
    throw lastError instanceof Error
      ? lastError
      : new Error(typeof lastError === 'string' && lastError ? lastError : 'Openverse search failed');
  }

  const metas: FrameAssetMeta[] = [];
  for (const r of data.results ?? []) {
    // Hard license guard: the query ASKS for cc0,pdm, but never trust the
    // response blindly — an unexpected license must be dropped, never
    // relabeled as CC0 (that would fabricate a rights grant).
    const licenseId = (r.license ?? '').toLowerCase();
    if (!r.id || !r.url || (licenseId !== 'cc0' && licenseId !== 'pdm')) continue;
    const license: AssetLicenseInfo = {
      provider: 'openverse',
      licenseId,
      licenseName: licenseId === 'pdm' ? 'Public Domain Mark' : 'CC0 1.0 Universal',
      licenseUrl: r.license_url ?? null,
      creator: r.creator ?? null,
      sourceUrl: r.foreign_landing_url ?? null,
      attributionRequired: false,
      attributionText: r.attribution ?? '',
    };
    const id = `openverse-${r.id}`;
    registerFreeAssetLicense(id, license);
    const thumb = r.thumbnail && r.thumbnail.trim() ? r.thumbnail : r.url;
    const aspect =
      typeof r.width === 'number' && typeof r.height === 'number' && r.height > 0
        ? r.width / r.height
        : null;
    metas.push({
      id,
      title: (r.title || 'Openverse photo').trim(),
      category: 'element',
      shape: 'rectangle',
      slot: null,
      is_pro: false,
      local_path: '',
      // Grid renders http thumb_path values directly (see AssetsPanel).
      thumb_path: thumb,
      remote_url: r.url,
      tags: ['openverse', licenseId, query],
      created_at: null,
      license,
      aspect,
    });
  }
  return metas;
}

/**
 * Build human-readable credit lines from the license records carried by
 * a set of canvas elements (album spreads or carousel slides).
 */
export function buildCreditsLines(
  elements: Array<{ name?: string; frameAssetTitle?: string | null; licenseInfo?: AssetLicenseInfo | null }>,
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const el of elements) {
    const info = el.licenseInfo;
    if (!info) continue;
    const title = el.frameAssetTitle || el.name || 'Asset';
    const key = `${info.provider}:${title}:${info.licenseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (info.attributionRequired && info.attributionText) {
      lines.push(info.attributionText);
    } else {
      const creator = info.creator ? ` by ${info.creator}` : '';
      lines.push(`${title}${creator} — ${info.licenseName} (via ${info.provider})`);
    }
  }
  return lines;
}
