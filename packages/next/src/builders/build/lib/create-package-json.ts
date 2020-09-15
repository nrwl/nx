import { BuilderContext } from '@angular-devkit/architect';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { readJsonFile } from '@nrwl/workspace';
import { NextBuildBuilderOptions } from '../../../utils/types';

export async function createPackageJson(
  options: NextBuildBuilderOptions,
  context: BuilderContext
) {
  const rootPackageJson = readJsonFile(
    join(context.workspaceRoot, 'package.json')
  );

  const outPackageJson = {
    name: context.target.project,
    version: '0.0.1',
    scripts: {
      start: 'next start',
    },
    dependencies: rootPackageJson.dependencies,
  };

  writeFileSync(
    join(options.outputPath, 'package.json'),
    JSON.stringify(outPackageJson, null, 2)
  );
}
