# Summary 16-01: `appStore` Mode & Viewport Hoisting + `projectStore` Auto-Mode Detection

**Plan:** 16-01  
**Phase:** 16 — Workspace Isolation & Mode State Synchronization  
**Requirements:** ISO-01, ISO-02  
**Executed:** 2026-09-29  
**Status:** ✅ COMPLETE

---

## Commits

| Hash | Message |
|------|---------|
| `a239348` | feat(ISO-01,ISO-02): add activeMode and per-mode viewport fields to appStore |
| `a532c82` | feat(ISO-01): projectStore calls setActiveMode on open/create/close |
| `07362d3` | refactor(ISO-01,ISO-02): hoist activeMode and viewport to appStore in WorkspaceLayout |
| `8f7cc6f` | test(ISO-01,ISO-02): add 8 unit tests for appStore mode & viewport isolation |

---

## Task 1 — `src/stores/appStore.ts`

### Changes Made

Added to `AppState` interface:
- `activeMode: 'print' | 'carousel'` — defaults to `'print'`
- `setActiveMode(mode)` — atomic setter
- `printZoom / carouselZoom: number` — each defaults to `100`, clamped to `[5, 350]`
- `printPan / carouselPan: { x: number; y: number }` — each defaults to `{ x: 0, y: 0 }`
- `printFitTrigger / carouselFitTrigger: number` — trigger counters for fit-to-screen
- `setPrintZoom / setCarouselZoom` — clamped at `Math.max(5, Math.min(350, z))`
- `setPrintPan / setCarouselPan` — direct pan setters
- `triggerPrintFit / triggerCarouselFit` — increment-only counters
- `resetViewportForMode(mode)` — resets zoom to 100, pan to `{0,0}`, and increments the appropriate fit trigger for the specified mode

### Design Decision

`resetViewportForMode` also increments the fit trigger so the canvas immediately runs a fit-to-screen animation on project open — without requiring a separate `triggerFit` call from `projectStore`.

---

## Task 2 — `src/stores/projectStore.ts`

### Changes Made

**`openProjectById`** (line ~549):
```typescript
const { useAppStore } = await import('./appStore');
useAppStore.getState().setActiveMode(isCarousel ? 'carousel' : 'print');
useAppStore.getState().resetViewportForMode(isCarousel ? 'carousel' : 'print');
```
Called **before** `loadCarouselFromDb` / `loadAlbumFromDb` so the correct canvas mode is active synchronously.

**`createNewProject`** — both Tauri success branch and local fallback:
- Same `setActiveMode` + `resetViewportForMode` pattern called after the `set(...)` call that sets `currentProject`
- The fallback branch uses a renamed import alias (`useAppStoreLocal`) to avoid shadowing

**`closeProject`** (line ~313):
```typescript
try {
  const { useAppStore } = await import('./appStore');
  useAppStore.getState().setActiveMode('print');
} catch {}
```
Wrapped in try/catch to guarantee project teardown completes even if the import fails.

---

## Task 3 — `src/features/workspace/WorkspaceLayout.tsx`

### Changes Made

**State hoisting (ISO-01, ISO-02):**
- Removed `useState` for `activeMode`, `zoomLevel`, `fitTrigger`
- Added `useAppStore` subscriptions: `activeMode`, `printZoom`, `carouselZoom`, `printFitTrigger`, `carouselFitTrigger`
- `zoomLevel` is a derived constant: `activeMode === 'carousel' ? carouselZoom : printZoom`
- `fitTrigger` is a derived constant: `activeMode === 'carousel' ? carouselFitTrigger : printFitTrigger`

**Mode-aware `handleFitToScreen`:**
```typescript
const handleFitToScreen = useCallback(() => {
  if (activeMode === 'carousel') {
    useAppStore.getState().triggerCarouselFit();
  } else {
    useAppStore.getState().triggerPrintFit();
  }
}, [activeMode]);
```

**Mode-aware `setZoomLevel` (ISO-02):**
```typescript
const setZoomLevel = useCallback(
  (updater: number | ((prev: number) => number)) => {
    const store = useAppStore.getState();
    const currentZoom = activeMode === 'carousel' ? store.carouselZoom : store.printZoom;
    const next = typeof updater === 'function' ? updater(currentZoom) : updater;
    if (activeMode === 'carousel') store.setCarouselZoom(next);
    else store.setPrintZoom(next);
  },
  [activeMode]
);
```

**Album `useEffect` carousel guard (ISO-01 race fix):**
- Before: always called `loadAlbumFromDb` on any `currentProject` change
- After: skips the entire album load branch for carousel projects
- Prevents a race where the `useEffect` fires before `openProjectById`'s async carousel loads complete

**`AppTitleBar` cleanup:**
- Removed `onModeSelect` prop — `activeMode` is now driven entirely by `appStore`; `AppTitleBar`'s mode buttons will call `appStore.getState().setActiveMode` directly in Plan 16-02

**`handleKeyDown` deps:**
- Added `setZoomLevel` to the dependency array so Cmd+= / Cmd+- always route to the correct mode's store setter

---

## Tests — `src/stores/__tests__/appStore-mode-viewport.test.ts`

All 8 tests **PASS** ✅

| Test | Status |
|------|--------|
| ISO-01: setActiveMode updates activeMode to carousel | ✅ |
| ISO-01: setActiveMode updates activeMode to print | ✅ |
| ISO-02: setPrintZoom and setCarouselZoom are independent | ✅ |
| ISO-02: zoom is clamped between 5 and 350 | ✅ |
| ISO-02: triggerPrintFit increments printFitTrigger only | ✅ |
| ISO-02: triggerCarouselFit increments carouselFitTrigger only | ✅ |
| ISO-02: resetViewportForMode(carousel) resets only carousel viewport | ✅ |
| ISO-02: resetViewportForMode(print) does not affect carousel viewport | ✅ |

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `useAppStore.getState().activeMode` returns `'carousel'` synchronously after `openProjectById` for carousel | ✅ (set before async loads) |
| `useAppStore.getState().activeMode` returns `'print'` after `openProjectById` for print project | ✅ |
| `useAppStore.getState().activeMode` returns `'print'` after `closeProject()` | ✅ |
| Cmd+= in Carousel mode increments `carouselZoom`, not `printZoom` | ✅ (mode-aware setZoomLevel) |
| Cmd+= in Print mode increments `printZoom`, not `carouselZoom` | ✅ |
| Opening Carousel then Print leaves Carousel zoom at its previous value | ✅ (isolated stores) |
| Album `useEffect` does NOT call `loadAlbumFromDb` for carousel projects | ✅ (isCarousel guard added) |
| `npx tsc --noEmit` exits with 0 errors | ✅ |
| All Vitest tests pass | ✅ (8/8) |

---

## Files Modified

| File | Change |
|------|--------|
| [`src/stores/appStore.ts`](../../../src/stores/appStore.ts) | +49 lines: ISO-01/ISO-02 fields, initial state, action implementations |
| [`src/stores/projectStore.ts`](../../../src/stores/projectStore.ts) | +20 lines: setActiveMode calls in open/create/close |
| [`src/features/workspace/WorkspaceLayout.tsx`](../../../src/features/workspace/WorkspaceLayout.tsx) | +53/-33 lines: state hoisting, carousel guard, dep array fix |
| [`src/stores/__tests__/appStore-mode-viewport.test.ts`](../../../src/stores/__tests__/appStore-mode-viewport.test.ts) | +70 lines: 8 unit tests |

---

*Plan 16-01 | Phase 16 | Requirements: ISO-01, ISO-02 | Wave 1*
