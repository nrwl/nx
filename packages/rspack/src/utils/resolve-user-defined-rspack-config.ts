import { loadConfigFile } from '@nx/devkit/internal';

export async function resolveUserDefinedRspackConfig(
  path: string,
  tsConfig: string,
  /** Skip require cache and return latest content */
  reload = false
) {
  await preloadRspackCore();
  return await loadConfigFile(path);
}

// Node keeps @rspack/core cached un-instantiated when a config's require(esm)
// link fails (e.g. an extensionless `.ts` sibling import under native type
// stripping), and every later require('@rspack/core') then throws
// "Unexpected module status 0". See https://github.com/nrwl/nx/issues/36685
async function preloadRspackCore(): Promise<void> {
  try {
    await new Function('return import("@rspack/core")')();
  } catch {
    // Not resolvable from here, or import() unavailable (e.g. under Jest).
    // Whatever is actually wrong surfaces when the config itself loads.
  }
}
