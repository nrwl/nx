// ensure we have the types for the externalApi on window
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { ExternalApi } from '@nx/graph/shared';

declare global {
  interface Window {
    externalApi: ExternalApi;
  }
}
