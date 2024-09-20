import { readNxJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';

export function isUsingTypeScriptPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);

  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson?.useInferencePlugins !== false;
  const addTsPlugin = addPlugin && process.env.NX_ADD_TS_PLUGIN === 'true';
  // is going to be added or it's already there
  const hasPlugin =
    addTsPlugin ||
    (nxJson?.plugins?.some((p) =>
      typeof p === 'string'
        ? p === '@nx/js/typescript'
        : p.plugin === '@nx/js/typescript'
    ) ??
      false);

  return hasPlugin;
}
