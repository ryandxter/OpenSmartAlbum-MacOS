#!/usr/bin/env node
/**
 * OpenSmartAlbum — single-source version sync.
 *
 * package.json is the source of truth. This script propagates its version
 * to every other place that carries it:
 *
 *   - package-lock.json            ("version" + packages[""].version)
 *   - src-tauri/tauri.conf.json    ("version")
 *   - src-tauri/Cargo.toml         ([package] version)
 *   - src-tauri/Cargo.lock         (the `opensmartalbum` package entry)
 *   - src/stores/appStore.ts       (initial appInfo fallback: 'vX.Y.Z')
 *   - src/hooks/useTauriInfo.ts    (browser-dev fallback: 'vX.Y.Z')
 *
 * Usage:
 *   node scripts/bump-version.mjs --check   # fail if anything is out of sync
 *   node scripts/bump-version.mjs 1.5.3     # set a new version everywhere
 *   node scripts/bump-version.mjs           # re-sync everything to package.json
 *
 * Exit code 0 = in sync / synced. 1 = drift found (--check) or bad input.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2] || '';
const checkOnly = arg === '--check';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}
function write(rel, content) {
  writeFileSync(join(root, rel), content);
}

/** Replace the first regex match; returns {content, found} without writing. */
function sub(content, regex, replacement) {
  if (!regex.test(content)) return { content, found: false };
  return { content: content.replace(regex, replacement), found: true };
}

// --- Resolve target version -------------------------------------------------
const pkg = JSON.parse(read('package.json'));
let target = pkg.version;
if (!checkOnly && arg) {
  const normalized = arg.replace(/^v/i, '');
  if (!SEMVER.test(normalized)) {
    console.error(`Invalid version "${arg}". Expected semver like 1.5.3`);
    process.exit(1);
  }
  target = normalized;
}
if (!SEMVER.test(target)) {
  console.error(`package.json version "${target}" is not semver.`);
  process.exit(1);
}

// --- Define every carrier ----------------------------------------------------
const carriers = [
  {
    file: 'package.json',
    get: (c) => JSON.parse(c).version,
    apply: (c) =>
      sub(c, /("name":\s*"open-smart-album",\s*\n\s*"private":\s*true,\s*\n\s*"version":\s*")[^"]+(")/, `$1${target}$2`),
  },
  {
    file: 'package-lock.json',
    // Both the root "version" and packages[""].version must agree,
    // otherwise the lockfile counts as drifted.
    get: (c) => {
      const p = JSON.parse(c);
      const inner = p.packages?.['']?.version;
      return p.version === inner ? p.version : `root=${p.version} packages[""]=${inner}`;
    },
    apply: (c) => {
      const r = sub(c, /("name":\s*"open-smart-album",\s*\n\s*"version":\s*")[^"]+(")/, `$1${target}$2`);
      const rootPkg = sub(
        r.content,
        /("":\s*\{\s*\n\s*"name":\s*"open-smart-album",\s*\n\s*"version":\s*")[^"]+(")/,
        `$1${target}$2`,
      );
      // BOTH replacements must land; a silent miss leaves npm ci broken.
      return { content: rootPkg.content, found: r.found && rootPkg.found };
    },
  },
  {
    file: 'src-tauri/tauri.conf.json',
    get: (c) => JSON.parse(c).version,
    apply: (c) => sub(c, /("productName":\s*"OpenSmartAlbum",\s*\n\s*"version":\s*")[^"]+(")/, `$1${target}$2`),
  },
  {
    file: 'src-tauri/Cargo.toml',
    get: (c) => (c.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/) || [])[1],
    apply: (c) => sub(c, /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/, `$1${target}$2`),
  },
  {
    file: 'src-tauri/Cargo.lock',
    // \r? — Windows checkouts (core.autocrlf) give this file CRLF endings,
    // and the release workflow runs the --check gate on windows-latest too.
    get: (c) => (c.match(/\[\[package\]\]\r?\nname = "opensmartalbum"\r?\nversion = "([^"]+)"/) || [])[1],
    apply: (c) =>
      sub(c, /(\[\[package\]\]\r?\nname = "opensmartalbum"\r?\nversion = ")[^"]+(")/, `$1${target}$2`),
  },
  {
    file: 'src/stores/appStore.ts',
    get: (c) => (c.match(/version:\s*'v([^']+)'/) || [])[1],
    apply: (c) => sub(c, /(version:\s*'v)[^']+(')/, `$1${target}$2`),
  },
  {
    file: 'src/hooks/useTauriInfo.ts',
    get: (c) => (c.match(/version:\s*'v([^']+)'/) || [])[1],
    apply: (c) => sub(c, /(version:\s*'v)[^']+(')/, `$1${target}$2`),
  },
];

// --- Run ----------------------------------------------------------------------
let drift = 0;
for (const carrier of carriers) {
  let content;
  try {
    content = read(carrier.file);
  } catch {
    console.warn(`SKIP  ${carrier.file} (not found)`);
    continue;
  }
  const current = carrier.get(content);
  if (current === target) {
    console.log(`OK    ${carrier.file} @ ${target}`);
    continue;
  }
  drift++;
  if (checkOnly) {
    console.log(`DRIFT ${carrier.file}: ${current ?? '(unparsed)'} != ${target}`);
    continue;
  }
  const { content: next, found } = carrier.apply(content);
  if (!found || next === content) {
    console.error(`FAIL  ${carrier.file}: version pattern not found — update scripts/bump-version.mjs`);
    process.exit(1);
  }
  write(carrier.file, next);
  console.log(`SYNC  ${carrier.file}: ${current ?? '(unparsed)'} -> ${target}`);
}

if (checkOnly && drift > 0) {
  console.error(`\n${drift} file(s) out of sync with package.json (${target}). Run: npm run version:sync`);
  process.exit(1);
}
console.log(checkOnly ? `\nAll version carriers in sync @ ${target}` : `\nVersion synced @ ${target}`);
