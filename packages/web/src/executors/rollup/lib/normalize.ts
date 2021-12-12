import { dirname } from 'path';

import { AssetGlobPattern } from '../../../utils/shared-models';
import { normalizeAssets, normalizePluginPath } from '../../../utils/normalize';
import { WebRollupOptions } from '../schema';

export interface NormalizedWebRollupOptions extends WebRollupOptions {
  entryRoot: string;
  projectRoot: string;
  assets: AssetGlobPattern[];
  rollupConfig: string[];
}

export function normalizeWebRollupOptions(
  options: WebRollupOptions,
  root: string,
  sourceRoot: string
): NormalizedWebRollupOptions {
  const entryFile = `${root}/${options.entryFile}`;
  const entryRoot = dirname(entryFile);
  const project = `${root}/${options.project}`;
  const projectRoot = dirname(project);
  const outputPath = `${root}/${options.outputPath}`;

  if (options.buildableProjectDepsInPackageJsonType == undefined) {
    options.buildableProjectDepsInPackageJsonType = 'peerDependencies';
  }

  return {
    ...options,
    // de-dupe formats
    format: Array.from(new Set(options.format)),
    rollupConfig: []
      .concat(options.rollupConfig)
      .filter(Boolean)
      .map((p) => normalizePluginPath(p, root)),
    assets: options.assets
      ? normalizeAssets(options.assets, root, sourceRoot)
      : undefined,
    entryFile,
    entryRoot,
    project,
    projectRoot,
    outputPath,
  };
}
