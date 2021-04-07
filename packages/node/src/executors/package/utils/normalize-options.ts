import { existsSync } from 'fs-extra';
import { ExecutorContext, normalizePath } from '@nrwl/devkit';

import * as glob from 'glob';
import { basename, dirname, join, relative } from 'path';

import {
  FileInputOutput,
  NodePackageBuilderOptions,
  NormalizedBuilderOptions,
} from './models';

export default function normalizeOptions(
  options: NodePackageBuilderOptions,
  context: ExecutorContext,
  libRoot: string
): NormalizedBuilderOptions {
  const outDir = options.outputPath;
  const files: FileInputOutput[] = [];

  const globbedFiles = (pattern: string, input = '', ignore: string[] = []) => {
    return glob.sync(pattern, {
      cwd: input,
      nodir: true,
      ignore,
    });
  };

  options.assets.forEach((asset) => {
    if (typeof asset === 'string') {
      globbedFiles(asset, context.root).forEach((globbedFile) => {
        files.push({
          input: join(context.root, globbedFile),
          output: join(context.root, outDir, basename(globbedFile)),
        });
      });
    } else {
      globbedFiles(
        asset.glob,
        join(context.root, asset.input),
        asset.ignore
      ).forEach((globbedFile) => {
        files.push({
          input: join(context.root, asset.input, globbedFile),
          output: join(context.root, outDir, asset.output, globbedFile),
        });
      });
    }
  });

  const rootDir = libRoot || '';

  if (options.main && !existsSync(options.main)) {
    throw new Error(
      `Please verify that the "main" option for project "${context.projectName}" is valid.`
    );
  }

  const mainFileDir = dirname(options.main);

  // Always include a preceding dot to match format used for entry points
  const relativeMainFileOutput = `./${normalizePath(
    relative(rootDir, mainFileDir)
  )}`;

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
