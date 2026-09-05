import type { Core } from 'cytoscape';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  applyGraphWheelSensitivity,
  DEFAULT_GRAPH_WHEEL_SENSITIVITY,
  getGraphWheelSensitivity,
  GRAPH_WHEEL_SENSITIVITY,
  registerGraphWheelSensitivityTestHooks,
} from './graph-wheel-sensitivity';

function createMockCy(wheelSensitivity = DEFAULT_GRAPH_WHEEL_SENSITIVITY) {
  const renderer = { wheelSensitivity };

  return {
    renderer,
    cy: {
      _private: { renderer },
      zoom: () => 1,
      container: () => null,
    } as unknown as Core,
  };
}

describe('graph wheel sensitivity', () => {
  describe('applyGraphWheelSensitivity', () => {
    it('sets a lower wheel sensitivity on the cytoscape renderer', () => {
      const { cy, renderer } = createMockCy();

      applyGraphWheelSensitivity(cy);

      expect(renderer.wheelSensitivity).toBe(GRAPH_WHEEL_SENSITIVITY);
    });

    it('does nothing when the renderer is unavailable', () => {
      const cy = {} as Core;

      expect(() => applyGraphWheelSensitivity(cy)).not.toThrow();
    });

    it('uses a sensitivity below the cytoscape default', () => {
      expect(GRAPH_WHEEL_SENSITIVITY).toBeLessThan(DEFAULT_GRAPH_WHEEL_SENSITIVITY);
    });
  });

  describe('getGraphWheelSensitivity', () => {
    it('reads the current wheel sensitivity from the renderer', () => {
      const { cy, renderer } = createMockCy(0.5);

      expect(getGraphWheelSensitivity(cy)).toBe(renderer.wheelSensitivity);
    });
  });

  describe('registerGraphWheelSensitivityTestHooks', () => {
    let originalEnvironment: string | undefined;

    beforeEach(() => {
      originalEnvironment = globalThis.window?.environment;
      vi.stubGlobal('window', {
        ...globalThis.window,
        environment: 'dev',
        __NX_GRAPH_TEST__: undefined,
      });
    });

    afterEach(() => {
      if (globalThis.window) {
        globalThis.window.environment = originalEnvironment;
        delete globalThis.window.__NX_GRAPH_TEST__;
      }
      vi.unstubAllGlobals();
    });

    it('registers dev-only test hooks on window', () => {
      const { cy, renderer } = createMockCy();
      renderer.wheelSensitivity = GRAPH_WHEEL_SENSITIVITY;

      registerGraphWheelSensitivityTestHooks(cy);

      expect(window.__NX_GRAPH_TEST__?.expectedSensitivity).toBe(
        GRAPH_WHEEL_SENSITIVITY
      );
      expect(window.__NX_GRAPH_TEST__?.getWheelSensitivity()).toBe(
        GRAPH_WHEEL_SENSITIVITY
      );
    });

    it('does not register hooks outside dev environment', () => {
      window.environment = 'release';
      const { cy } = createMockCy();

      registerGraphWheelSensitivityTestHooks(cy);

      expect(window.__NX_GRAPH_TEST__).toBeUndefined();
    });
  });
});
