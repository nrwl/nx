import { ExecutorContext, normalizePath } from '@nrwl/devkit';

import {
  readJsonFile,
  writeJsonFile,
} from '@nrwl/workspace/src/utilities/fileutils';
import { basename, join } from 'path';
import { NormalizedBuilderOptions } from './models';

export default function updatePackageJson(
  options: NormalizedBuilderOptions,
  context: ExecutorContext
) {
  const mainFile = basename(options.main).replace(/\.[tj]s$/, '');
  const typingsFile = `${mainFile}.d.ts`;
  const mainJsFile = `${mainFile}.js`;
  const packageJson = readJsonFile(join(context.root, options.packageJson));

  packageJson.main = normalizePath(
    `${options.relativeMainFileOutput}/${mainJsFile}`
  );
  packageJson.typings = normalizePath(
    `${options.relativeMainFileOutput}/${typingsFile}`
  );

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
