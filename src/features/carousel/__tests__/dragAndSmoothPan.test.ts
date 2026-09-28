/**
 * Unit tests for Drag Ghost Badge & Carousel Smooth Panning Math
 */
import { setInBoundsDragGhostBadge, cleanupDragGhostBadge } from '../../photos/dragGhostBadge';
import { usePhotoStore } from '../../../stores/photoStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Testing WebKit Drag Ghost Badge & Carousel Smooth Panning Math ---');

// Test 1: Ghost badge DOM setup with in-bounds coordinates and initial opacity
{
  // Setup minimal DOM mock if running in Node environment
  if (typeof document === 'undefined') {
    const elements = new Map<string, any>();
    (globalThis as any).document = {
      getElementById: (id: string) => elements.get(id) || null,
      createElement: (_tag: string) => {
        const el: any = {
          id: '',
          style: {},
          textContent: '',
        };
        return el;
      },
      body: {
        appendChild: (el: any) => {
          elements.set(el.id, el);
        },
      },
    };
  }

  let rafCallback: ((time: number) => void) | null = null;
  (globalThis as any).requestAnimationFrame = (cb: (time: number) => void) => {
    rafCallback = cb;
    return 1;
  };

  let dragImageTarget: any = null;
  let dragImageX = -1;
  let dragImageY = -1;
  const mockDragEvent = {
    dataTransfer: {
      setDragImage: (img: any, x: number, y: number) => {
        dragImageTarget = img;
        dragImageX = x;
        dragImageY = y;
      },
    },
  } as unknown as React.DragEvent;

  setInBoundsDragGhostBadge('📁 3 Photos Selected', mockDragEvent);

  const badge = document.getElementById('afsn-drag-ghost-badge') as HTMLElement;
  assert(badge !== null, 'Ghost badge element should exist in DOM');
  assert(badge.style.position === 'fixed', 'Ghost badge should be fixed position');
  assert(badge.style.top === '0px', 'Ghost badge top should be 0px (in-bounds viewport)');
  assert(badge.style.left === '0px', 'Ghost badge left should be 0px (in-bounds viewport)');
  assert(badge.style.zIndex === '999999', 'Ghost badge zIndex should be 999999');
  assert(badge.style.display === 'block', 'Ghost badge display should be block on dragstart');
  assert(badge.style.opacity === '1', 'Ghost badge opacity should be 1 during initial snapshot');
  assert(badge.textContent === '📁 3 Photos Selected', 'Ghost badge text matches selection count');
  assert(dragImageTarget === badge, 'Drag image target should be badge element');
  assert(dragImageX === 20 && dragImageY === 16, 'Drag image offsets should be (20, 16)');

  // Fire RAF callback
  assert(rafCallback !== null, 'RAF should have been scheduled');
  rafCallback!(performance.now());
  assert(badge.style.opacity === '0.01', 'Ghost badge opacity should transition to 0.01 via RAF');
  assert(badge.style.pointerEvents === 'none', 'Ghost badge should have pointer-events none');

  // Test cleanup
  usePhotoStore.setState({ draggedPhotoIds: ['p1', 'p2', 'p3'] });
  cleanupDragGhostBadge();
  assert(badge.style.display === 'none', 'Ghost badge display should be none on cleanup');
  assert(usePhotoStore.getState().draggedPhotoIds.length === 0, 'draggedPhotoIds should be cleared on cleanup');

  console.log('✓ Test 1: In-bounds Drag Ghost Badge DOM and opacity lifecycle passed');
}

// Test 2: Viewport Centering Coordinate Calculation Math
{
  function computeTargetViewportCenter(params: {
    containerWidth: number;
    containerHeight: number;
    slideWidth: number;
    slideHeight: number;
    slideIndex: number;
    zoomLevel: number;
  }) {
    const S = params.zoomLevel / 100;
    const Xs = params.slideIndex * params.slideWidth;
    const Ws = params.slideWidth;
    const Hs = params.slideHeight;
    const Wc = params.containerWidth;
    const Hc = params.containerHeight;

    const targetX = Math.round(Wc / 2 - (Xs + Ws / 2) * S);
    const targetY = Math.round(Hc / 2 - (Hs / 2) * S);

    return { targetX, targetY };
  }

  // Slide 0 at 100% zoom with 1200x800 container and 1080x1080 slide
  const centerSlide0 = computeTargetViewportCenter({
    containerWidth: 1200,
    containerHeight: 800,
    slideWidth: 1080,
    slideHeight: 1080,
    slideIndex: 0,
    zoomLevel: 100,
  });
  // Wc/2 = 600, (Xs + Ws/2)*S = 540 -> targetX = 60
  // Hc/2 = 400, (Hs/2)*S = 540 -> targetY = -140
  assert(centerSlide0.targetX === 60, `targetX should be 60, got ${centerSlide0.targetX}`);
  assert(centerSlide0.targetY === -140, `targetY should be -140, got ${centerSlide0.targetY}`);

  // Slide 1 at 50% zoom
  const centerSlide1 = computeTargetViewportCenter({
    containerWidth: 1200,
    containerHeight: 800,
    slideWidth: 1080,
    slideHeight: 1080,
    slideIndex: 1,
    zoomLevel: 50,
  });
  // S = 0.5; Xs = 1080; (1080 + 540)*0.5 = 810 -> targetX = 600 - 810 = -210
  // (1080/2)*0.5 = 270 -> targetY = 400 - 270 = 130
  assert(centerSlide1.targetX === -210, `targetX should be -210, got ${centerSlide1.targetX}`);
  assert(centerSlide1.targetY === 130, `targetY should be 130, got ${centerSlide1.targetY}`);

  console.log('✓ Test 2: Viewport Centering Coordinate Calculation Math passed');
}

// Test 3: Ease-out cubic curve boundary values and monotonicity
{
  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  assert(easeOutCubic(0) === 0, 'easeOutCubic(0) must be 0');
  assert(easeOutCubic(1) === 1, 'easeOutCubic(1) must be 1');
  assert(easeOutCubic(0.5) === 0.875, 'easeOutCubic(0.5) must be 0.875');

  // Verify strict monotonicity
  let prev = 0;
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const cur = easeOutCubic(t);
    assert(cur > prev, `easeOutCubic should be strictly increasing at t=${t}`);
    prev = cur;
  }

  console.log('✓ Test 3: easeOutCubic easing curve properties passed');
}

console.log('All Drag & Smooth Pan tests passed successfully!');
