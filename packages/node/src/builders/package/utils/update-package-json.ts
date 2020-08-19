import { BuilderContext } from '@angular-devkit/architect';
import { readJsonFile } from '@nrwl/workspace';
import { writeJsonFile } from '@nrwl/workspace/src/utils/fileutils';
import { basename, join, normalize } from 'path';
import { NormalizedBuilderOptions } from './models';

export default function updatePackageJson(
  options: NormalizedBuilderOptions,
  context: BuilderContext
) {
  const mainFile = basename(options.main, '.ts');
  const typingsFile = `${mainFile}.d.ts`;
  const mainJsFile = `${mainFile}.js`;
  const packageJson = readJsonFile(
    join(context.workspaceRoot, options.packageJson)
  );

  packageJson.main = normalize(
    `./${options.relativeMainFileOutput}/${mainJsFile}`
  );
  packageJson.typings = normalize(
    `./${options.relativeMainFileOutput}/${typingsFile}`
  );

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
