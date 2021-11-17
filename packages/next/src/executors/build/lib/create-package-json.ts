import type { ExecutorContext } from '@nrwl/devkit';
import { writeJsonFile } from '@nrwl/devkit';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { createPackageJson as generatePackageJson } from '@nrwl/workspace/src/utilities/create-package-json';
import type { NextBuildBuilderOptions } from '../../../utils/types';

export async function createPackageJson(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const depGraph = readCachedProjectGraph();
  const packageJson = generatePackageJson(context.projectName, depGraph, {
    root: context.root,
    projectRoot: context.workspace.projects[context.projectName].sourceRoot,
  });
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.start = 'next start';
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  const nrwlWorkspaceNode = depGraph.nodes['npm:@nrwl/workspace'];

  if (nrwlWorkspaceNode) {
    packageJson.dependencies['@nrwl/workspace'] =
      nrwlWorkspaceNode.data.version;
  }

  const typescriptNode = depGraph.nodes['npm:typescript'];
  if (typescriptNode) {
    packageJson.dependencies['typescript'] = typescriptNode.data.version;
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
