import { logger } from '@nx/devkit';

// TODO(v25): Remove @nx/remix entirely - the plugin (createNodes), createWatchPaths,
// plugins/component-testing and the convert-to-inferred generator.
export const REMIX_DEPRECATION_MESSAGE =
  '@nx/remix is deprecated and will be removed in Nx 25. Migrate to React Router with @nx/react. See https://nx.dev/docs/technologies/react/remix/introduction for migration instructions.';

let warned = false;

export function warnRemixDeprecation(): void {
  if (!warned) {
    logger.warn(REMIX_DEPRECATION_MESSAGE);
    warned = true;
  }
}
