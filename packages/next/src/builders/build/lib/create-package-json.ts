import { BuilderContext } from '@angular-devkit/architect';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { readJsonFile } from '@nrwl/workspace';
import { NextBuildBuilderOptions } from '../../../utils/types';
import { reactDomVersion, reactVersion } from '@nrwl/react/src/utils/versions';

export async function createPackageJson(
  options: NextBuildBuilderOptions,
  context: BuilderContext
) {
  const rootPackageJson = readJsonFile(
    join(context.workspaceRoot, 'package.json')
  );

  const allWorkspaceDeps = {
    ...rootPackageJson.dependencies,
    ...rootPackageJson.devDependencies,
  };

  const outPackageJson = {
    name: context.target.project,
    version: '0.0.1',
    scripts: {
      start: 'next start',
    },
    dependencies: {
      next: allWorkspaceDeps.next,
      react: allWorkspaceDeps.react || reactVersion,
      'react-dom': allWorkspaceDeps['react-dom'] || reactDomVersion,
    },
    devDependencies: {},
  };

  writeFileSync(
    join(options.outputPath, 'package.json'),
    JSON.stringify(outPackageJson, null, 2)
  );
}
