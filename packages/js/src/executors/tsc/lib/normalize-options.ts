import { resolve } from 'path';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../utils/schema';
import {
  FileInputOutput,
  assetGlobsToFiles,
} from '../../../utils/assets/assets';
import { joinPathFragments } from 'nx/src/utils/path';

export function normalizeOptions(
  options: ExecutorOptions,
  contextRoot: string,
  sourceRoot: string,
  projectRoot: string
): NormalizedExecutorOptions {
  const outputPath = joinPathFragments(contextRoot, options.outputPath);
  const rootDir = options.rootDir
    ? joinPathFragments(contextRoot, options.rootDir)
    : joinPathFragments(contextRoot, projectRoot);

  if (options.watch == null) {
    options.watch = false;
  }

  // TODO: put back when inlining story is more stable
  // if (options.external == null) {
  //   options.external = 'all';
  // } else if (Array.isArray(options.external) && options.external.length === 0) {
  //   options.external = 'none';
  // }

  if (Array.isArray(options.external) && options.external.length > 0) {
    const firstItem = options.external[0];
    if (firstItem === 'all' || firstItem === 'none') {
      options.external = firstItem;
    }
  }

  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    contextRoot,
    outputPath
  );

  return {
    ...options,
    root: contextRoot,
    sourceRoot,
    projectRoot,
    files,
    outputPath,
    tsConfig: joinPathFragments(contextRoot, options.tsConfig),
    rootDir,
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
  };
}
