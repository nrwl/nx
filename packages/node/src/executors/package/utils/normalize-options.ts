import { ExecutorContext, normalizePath } from '@nrwl/devkit';
import {
  assetGlobsToFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { existsSync } from 'fs-extra';
import { dirname, join, relative } from 'path';
import { NodePackageBuilderOptions, NormalizedBuilderOptions } from './models';

export default function normalizeOptions(
  options: NodePackageBuilderOptions,
  context: ExecutorContext,
  libRoot: string
): NormalizedBuilderOptions {
  const outDir = join(context.root, options.outputPath);
  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    context.root,
    outDir
  );

  const rootDir = libRoot || '';

  if (options.main && !existsSync(options.main)) {
    throw new Error(
      `Please verify that the "main" option for project "${context.projectName}" is valid.`
    );
  }

  const mainFileDir = dirname(options.main);

  // Always include a preceding dot to match format used for entry points
  const relativeDir = normalizePath(relative(rootDir, mainFileDir));
  const relativeMainFileOutput =
    relativeDir === '' ? `./` : `./${relativeDir}/`;

  if (options.buildableProjectDepsInPackageJsonType == undefined) {
    options.buildableProjectDepsInPackageJsonType = 'dependencies';
  }

  return {
    ...options,
    files,
    relativeMainFileOutput,
    normalizedOutputPath: join(context.root, options.outputPath),
  };
}
