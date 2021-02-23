import { ExecutorContext } from '@nrwl/devkit';

import { writeFileSync } from 'fs';
import { join } from 'path';

import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { calculateProjectDependencies } from '@nrwl/workspace/src/utilities/buildable-libs-utils';

import { NextBuildBuilderOptions } from '../../../utils/types';

function getProjectDeps(context: ExecutorContext, rootPackageJson: any) {
  const projGraph = createProjectGraph();
  const { dependencies: deps } = calculateProjectDependencies(
    projGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  const depNames = deps
    .map((d) => d.node)
    .filter((node) => node.type === 'npm')
    .map((node) => node.data.packageName)
    // Need to make sure @nrwl/workspace is installed
    // It is only a peer dependency of @nrwl/next so does not get installed automatically
    // See: https://github.com/nrwl/nx/issues/4336
    .concat('@nrwl/workspace');
  const dependencies: string[] = depNames
    .filter((packageName) => packageName in rootPackageJson.dependencies)
    .reduce((deps, pkgName) => {
      return { ...deps, [pkgName]: rootPackageJson.dependencies[pkgName] };
    }, {});
  const devDependencies = depNames
    .filter((packageName) => packageName in rootPackageJson.devDependencies)
    .reduce((deps, pkgName) => {
      return { ...deps, [pkgName]: rootPackageJson.devDependencies[pkgName] };
    }, {});
  return {
    dependencies,
    devDependencies,
  };
}

export function createPackageJson(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const rootPackageJson = readJsonFile(join(context.root, 'package.json'));
  const { dependencies, devDependencies } = getProjectDeps(
    context,
    rootPackageJson
  );

  const outPackageJson = {
    name: context.projectName,
    version: '0.0.1',
    scripts: {
      start: 'next start',
    },
    dependencies: {
      ...dependencies,
      // peer deps of next, so we need to add them here
      react: rootPackageJson.dependencies['react'],
      'react-dom': rootPackageJson.dependencies['react-dom'],
      next: rootPackageJson.dependencies['next'],
    },
    // needed for the next.config.js file
    devDependencies,
  };

  writeFileSync(
    join(options.outputPath, 'package.json'),
    JSON.stringify(outPackageJson, null, 2)
  );
}
