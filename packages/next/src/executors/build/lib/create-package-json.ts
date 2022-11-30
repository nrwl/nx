import type { ExecutorContext } from '@nrwl/devkit';
import { writeJsonFile } from '@nrwl/devkit';
import { createPackageJson as generatePackageJson } from 'nx/src/utils/create-package-json';
import type { NextBuildBuilderOptions } from '../../../utils/types';

export async function createPackageJson(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const packageJson = generatePackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
    }
  );

  // By default we remove devDependencies since this is a production build.
  if (!options.includeDevDependenciesInPackageJson) {
    delete packageJson.devDependencies;
  }

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.start = 'next start';

  const typescriptNode = context.projectGraph.externalNodes['npm:typescript'];
  if (typescriptNode) {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies['typescript'] = typescriptNode.data.version;
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
