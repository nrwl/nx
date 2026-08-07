// ensure we have the types for the externalApi on window
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { ExternalApi } from '@nx/graph/shared';

interface GraphWheelSensitivityTestApi {
  expectedSensitivity: number;
  defaultSensitivity: number;
  getWheelSensitivity: () => number | undefined;
  getZoom: () => number;
}

declare global {
  interface Window {
    externalApi: ExternalApi;
    environment?: string;
    __NX_GRAPH_TEST__?: GraphWheelSensitivityTestApi;
  }
}
