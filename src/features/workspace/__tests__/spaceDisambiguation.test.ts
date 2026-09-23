function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.strictEqual = function <T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, but got ${String(actual)}`);
  }
};

assert.ok = function (condition: unknown, message?: string): asserts condition {
  assert(condition, message);
};

console.log('🧪 Starting Plan 10-03: Spacebar Tap vs Pan Disambiguation Verification...\n');

// Pure state machine simulation matching WorkspaceLayout logic
class SpaceDisambiguationStateMachine {
  spaceDownTime: number | null = null;
  isSpaceHeld = false;
  hasDragged = false;
  shiftHeld = false;
  pointerDownPos: { x: number; y: number } | null = null;

  cycleLayoutCalls: Array<'next' | 'prev'> = [];

  onKeyDown(code: string, shiftKey: boolean, targetTag?: string, editingCrop = false, editingText = false, now = 0) {
    if (code !== 'Space') return;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'CONTENTEDITABLE') return;
    if (editingCrop || editingText) return;

    this.spaceDownTime = now;
    this.isSpaceHeld = true;
    this.hasDragged = false;
    this.shiftHeld = shiftKey;
    this.pointerDownPos = null;
  }

  onPointerMove(clientX: number, clientY: number, buttons: number) {
    if (this.isSpaceHeld && (buttons === 1 || buttons === 4)) {
      if (!this.pointerDownPos) {
        this.pointerDownPos = { x: clientX, y: clientY };
      } else {
        const dx = clientX - this.pointerDownPos.x;
        const dy = clientY - this.pointerDownPos.y;
        if (Math.hypot(dx, dy) > 4) {
          this.hasDragged = true;
        }
      }
    }
  }

  onKeyUp(code: string, targetTag?: string, now = 0) {
    if (code !== 'Space') return;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'CONTENTEDITABLE') return;

    if (this.isSpaceHeld) {
      const downTime = this.spaceDownTime;
      const elapsed = downTime !== null ? now - downTime : 9999;
      const wasDrag = this.hasDragged;
      const shift = this.shiftHeld;

      this.isSpaceHeld = false;
      this.spaceDownTime = null;
      this.hasDragged = false;
      this.pointerDownPos = null;

      if (!wasDrag && elapsed < 600) {
        this.cycleLayoutCalls.push(shift ? 'prev' : 'next');
      }
    }
  }
}

// Suite 1: Clean Tap Detection (Space alone, 120ms, no drag) -> cycle 'next'
{
  const sm = new SpaceDisambiguationStateMachine();
  sm.onKeyDown('Space', false, 'DIV', false, false, 100);
  sm.onKeyUp('Space', 'DIV', 220);

  assert.strictEqual(sm.cycleLayoutCalls.length, 1, 'Should trigger cycleLayout once');
  assert.strictEqual(sm.cycleLayoutCalls[0], 'next', 'Should trigger next layout');
  console.log('  ✅ Suite 1 Passed: Single tap cleanly triggers cycleLayout("next")');
}

// Suite 2: Shift+Space Clean Tap Detection (150ms, no drag) -> cycle 'prev'
{
  const sm = new SpaceDisambiguationStateMachine();
  sm.onKeyDown('Space', true, 'DIV', false, false, 500);
  sm.onKeyUp('Space', 'DIV', 650);

  assert.strictEqual(sm.cycleLayoutCalls.length, 1, 'Should trigger cycleLayout once');
  assert.strictEqual(sm.cycleLayoutCalls[0], 'prev', 'Should trigger prev layout on Shift+Space');
  console.log('  ✅ Suite 2 Passed: Shift+Space cleanly triggers cycleLayout("prev")');
}

// Suite 3: Pan Drag Cancellation (Space + drag > 4px) -> NO cycleLayout
{
  const sm = new SpaceDisambiguationStateMachine();
  sm.onKeyDown('Space', false, 'DIV', false, false, 100);

  // Mouse moves with button 1 pressed (panning)
  sm.onPointerMove(100, 100, 1);
  sm.onPointerMove(125, 110, 1); // 27px displacement > 4px

  assert.strictEqual(sm.hasDragged, true, 'State machine must register pan drag');

  sm.onKeyUp('Space', 'DIV', 350);

  assert.strictEqual(
    sm.cycleLayoutCalls.length,
    0,
    'Must NOT trigger layout cycling when Space was used for hand pan'
  );
  console.log('  ✅ Suite 3 Passed: Pan drag cleanly cancels layout cycling');
}

// Suite 4: Form Input Suppression (Typing in INPUT / TEXTAREA) -> NO cycleLayout
{
  const sm = new SpaceDisambiguationStateMachine();
  sm.onKeyDown('Space', false, 'INPUT', false, false, 100);
  sm.onKeyUp('Space', 'INPUT', 180);

  assert.strictEqual(sm.cycleLayoutCalls.length, 0, 'Must NOT trigger when focused on input');

  sm.onKeyDown('Space', false, 'TEXTAREA', false, false, 300);
  sm.onKeyUp('Space', 'TEXTAREA', 390);

  assert.strictEqual(sm.cycleLayoutCalls.length, 0, 'Must NOT trigger when focused on textarea');
  console.log('  ✅ Suite 4 Passed: Input/textarea typing correctly suppressed');
}

// Suite 5: Extended Hold (> 600ms) Cancellation -> NO cycleLayout
{
  const sm = new SpaceDisambiguationStateMachine();
  sm.onKeyDown('Space', false, 'DIV', false, false, 100);
  sm.onKeyUp('Space', 'DIV', 900); // 800ms hold

  assert.strictEqual(
    sm.cycleLayoutCalls.length,
    0,
    'Must NOT trigger layout cycling when Space was held longer than 600ms'
  );
  console.log('  ✅ Suite 5 Passed: Extended hold (>600ms) cancels layout cycling');
}

// Suite 6: In-Crop or In-Text Editing Mode Suppression -> NO cycleLayout
{
  const sm = new SpaceDisambiguationStateMachine();
  sm.onKeyDown('Space', false, 'DIV', true, false, 100); // editingCrop = true
  sm.onKeyUp('Space', 'DIV', 200);

  assert.strictEqual(sm.cycleLayoutCalls.length, 0, 'Must NOT trigger when editing crop frame');

  sm.onKeyDown('Space', false, 'DIV', false, true, 300); // editingText = true
  sm.onKeyUp('Space', 'DIV', 400);

  assert.strictEqual(sm.cycleLayoutCalls.length, 0, 'Must NOT trigger when editing text');
  console.log('  ✅ Suite 6 Passed: In-crop and in-text editing correctly suppressed');
}

console.log('\n🎉 All Plan 10-03 Spacebar Disambiguation tests passed successfully!\n');
