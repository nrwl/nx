import { readCachedProjectGraph } from '@nx/devkit';

export function shouldSkipModuleFederationSetup(): boolean {
  if (!global.NX_GRAPH_CREATION) {
    return false;
  }

  try {
    readCachedProjectGraph();
    return false;
  } catch {
    return true;
  }
}
