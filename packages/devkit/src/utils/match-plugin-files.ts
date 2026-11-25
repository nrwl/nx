import {
  findMatchingConfigFiles,
  matchPluginFiles as nxMatchPluginFiles,
} from 'nx/src/devkit-internals';

export interface PluginFileGlobs {
  pattern?: string;
  include?: string[];
  exclude?: string[];
  /** Names the plugin in pattern errors. */
  name?: string;
  /** The plugin's position in `nx.json` `plugins`, for pattern errors. */
  index?: number;
}

/**
 * The `paths` that pass a plugin's `createNodes` pattern, `include` and
 * `exclude`. Matches only the given paths, so files that exist only in a
 * generator `Tree` work.
 */
export function matchPluginFiles(
  paths: string[],
  globs: PluginFileGlobs
): string[] {
  if (nxMatchPluginFiles) {
    return nxMatchPluginFiles(paths, globs);
  }
  return matchPluginFilesForOlderNx(paths, globs);
}

// TODO(v26): remove once devkit no longer supports an nx without `matchPluginFiles`.
function matchPluginFilesForOlderNx(
  paths: string[],
  { pattern, include, exclude }: PluginFileGlobs
): string[] {
  const matchingPattern = pattern
    ? findMatchingConfigFiles(paths, [pattern], [])
    : paths;
  return findMatchingConfigFiles(matchingPattern, include, exclude);
}
