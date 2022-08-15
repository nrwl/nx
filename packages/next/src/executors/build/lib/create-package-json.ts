import type { ExecutorContext } from '@nrwl/devkit';
import { writeJsonFile } from '@nrwl/devkit';
import { createPackageJson as generatePackageJson } from '@nrwl/workspace/src/utilities/create-package-json';
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
      projectRoot: context.workspace.projects[context.projectName].sourceRoot,
    }
  );
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.start = 'next start';
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  const nrwlWorkspaceNode =
    context.projectGraph.externalNodes['npm:@nrwl/workspace'];

  if (nrwlWorkspaceNode) {
    packageJson.dependencies['@nrwl/workspace'] =
      nrwlWorkspaceNode.data.version;
  }

  const typescriptNode = context.projectGraph.externalNodes['npm:typescript'];
  if (typescriptNode) {
    packageJson.dependencies['typescript'] = typescriptNode.data.version;
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
