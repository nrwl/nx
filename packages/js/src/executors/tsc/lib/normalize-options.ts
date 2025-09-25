import { join, resolve } from 'path';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../utils/schema';
import {
  FileInputOutput,
  assetGlobsToFiles,
} from '../../../utils/assets/assets';

export function normalizeOptions(
  options: ExecutorOptions,
  contextRoot: string,
  sourceRoot: string,
  projectRoot: string
): NormalizedExecutorOptions {
  const outputPath = join(contextRoot, options.outputPath);
  const rootDir = options.rootDir
    ? join(contextRoot, options.rootDir)
    : join(contextRoot, projectRoot);

  if (options.watch == null) {
    options.watch = false;
  }

  options.assets ??= [];
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
    tsConfig: join(contextRoot, options.tsConfig),
    rootDir,
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
    generatePackageJson: options.generatePackageJson ?? true,
  };
}
