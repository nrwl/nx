import { ExecutorContext } from '@nrwl/devkit';

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

  if (!packageJson.main) {
    packageJson.main = `${options.relativeMainFileOutput}${mainJsFile}`;
  }

  if (!packageJson.typings) {
    packageJson.typings = `${options.relativeMainFileOutput}${typingsFile}`;
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
