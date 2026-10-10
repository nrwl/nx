import type { Core } from 'cytoscape';

/**
 * Cytoscape's default wheel sensitivity (1) produces large zoom jumps per scroll
 * tick on many mice. A lower value yields finer zoom control.
 * @see https://github.com/nrwl/nx/issues/33359
 */
export const GRAPH_WHEEL_SENSITIVITY = 0.25;

/** Cytoscape default — used as upper bound in e2e assertions. */
export const DEFAULT_GRAPH_WHEEL_SENSITIVITY = 1;

interface CytoscapeRenderer {
  wheelSensitivity: number;
}

function getCytoscapeRenderer(cy: Core): CytoscapeRenderer | undefined {
  return (cy as unknown as { _private?: { renderer?: CytoscapeRenderer } })
    ._private?.renderer;
}

export function getGraphWheelSensitivity(cy: Core): number | undefined {
  return getCytoscapeRenderer(cy)?.wheelSensitivity;
}

export interface GraphWheelSensitivityTestApi {
  expectedSensitivity: number;
  defaultSensitivity: number;
  getWheelSensitivity: () => number | undefined;
  getZoom: () => number;
}

export function registerGraphWheelSensitivityTestHooks(cy: Core): void {
  if (typeof window === 'undefined' || window.environment !== 'dev') return;

  window.__NX_GRAPH_TEST__ = {
    expectedSensitivity: GRAPH_WHEEL_SENSITIVITY,
    defaultSensitivity: DEFAULT_GRAPH_WHEEL_SENSITIVITY,
    getWheelSensitivity: () => getGraphWheelSensitivity(cy),
    getZoom: () => cy.zoom(),
  };
}

export function applyGraphWheelSensitivity(cy: Core): void {
  const renderer = getCytoscapeRenderer(cy);

  if (!renderer) return;

  renderer.wheelSensitivity = GRAPH_WHEEL_SENSITIVITY;
  registerGraphWheelSensitivityTestHooks(cy);
}
