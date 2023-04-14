import type { Tree } from '@nx/devkit';
import { normalizeNameAndPaths } from '../../utils/path';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const { directory, fileName, filePath, name, path } = normalizeNameAndPaths(
    tree,
    {
      ...options,
      type: 'pipe',
    }
  );

  return {
    ...options,
    export: options.export ?? true,
    flat: options.flat ?? true,
    inlineScam: options.inlineScam ?? true,
    directory,
    fileName,
    filePath,
    name,
    path,
  };
}
