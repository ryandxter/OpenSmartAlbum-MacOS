import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('appStore — activeMode & viewport isolation (ISO-01, ISO-02)', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeMode: 'print',
      printZoom: 100,
      carouselZoom: 100,
      printPan: { x: 0, y: 0 },
      carouselPan: { x: 0, y: 0 },
      printFitTrigger: 0,
      carouselFitTrigger: 0,
    });
  });

  it('ISO-01: setActiveMode updates activeMode to carousel', () => {
    useAppStore.getState().setActiveMode('carousel');
    expect(useAppStore.getState().activeMode).toBe('carousel');
  });

  it('ISO-01: setActiveMode updates activeMode to print', () => {
    useAppStore.getState().setActiveMode('carousel');
    useAppStore.getState().setActiveMode('print');
    expect(useAppStore.getState().activeMode).toBe('print');
  });

  it('ISO-02: setPrintZoom and setCarouselZoom are independent', () => {
    useAppStore.getState().setPrintZoom(150);
    useAppStore.getState().setCarouselZoom(75);
    expect(useAppStore.getState().printZoom).toBe(150);
    expect(useAppStore.getState().carouselZoom).toBe(75);
  });

  it('ISO-02: zoom is clamped between 5 and 350', () => {
    useAppStore.getState().setPrintZoom(9999);
    expect(useAppStore.getState().printZoom).toBe(350);
    useAppStore.getState().setCarouselZoom(-100);
    expect(useAppStore.getState().carouselZoom).toBe(5);
  });

  it('ISO-02: triggerPrintFit increments printFitTrigger only', () => {
    useAppStore.getState().triggerPrintFit();
    expect(useAppStore.getState().printFitTrigger).toBe(1);
    expect(useAppStore.getState().carouselFitTrigger).toBe(0);
  });

  it('ISO-02: triggerCarouselFit increments carouselFitTrigger only', () => {
    useAppStore.getState().triggerCarouselFit();
    expect(useAppStore.getState().carouselFitTrigger).toBe(1);
    expect(useAppStore.getState().printFitTrigger).toBe(0);
  });

  it('ISO-02: resetViewportForMode(carousel) resets only carousel viewport', () => {
    useAppStore.getState().setCarouselZoom(250);
    useAppStore.getState().setCarouselPan({ x: 500, y: 300 });
    useAppStore.getState().setPrintZoom(180);
    useAppStore.getState().resetViewportForMode('carousel');
    expect(useAppStore.getState().carouselZoom).toBe(100);
    expect(useAppStore.getState().carouselPan).toEqual({ x: 0, y: 0 });
    // Print state must be unaffected
    expect(useAppStore.getState().printZoom).toBe(180);
  });

  it('ISO-02: resetViewportForMode(print) does not affect carousel viewport', () => {
    useAppStore.getState().setCarouselZoom(200);
    useAppStore.getState().resetViewportForMode('print');
    expect(useAppStore.getState().carouselZoom).toBe(200);
  });
});
