import { BuilderContext } from '@angular-devkit/architect';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { readJsonFile } from '@nrwl/workspace';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { calculateProjectDependencies } from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { NextBuildBuilderOptions } from '../../../utils/types';

function getProjectDeps(context: BuilderContext, rootPackageJson: any) {
  const projGraph = createProjectGraph();
  const { dependencies: deps } = calculateProjectDependencies(
    projGraph,
    context
  );
  const depNames = deps
    .map((d) => d.node)
    .filter((node) => node.type === 'npm')
    .map((node) => node.data.packageName);
  const dependencies = depNames
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

export async function createPackageJson(
  options: NextBuildBuilderOptions,
  context: BuilderContext
) {
  const rootPackageJson = readJsonFile(
    join(context.workspaceRoot, 'package.json')
  );
  const { dependencies, devDependencies } = getProjectDeps(
    context,
    rootPackageJson
  );

  const outPackageJson = {
    name: context.target.project,
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
