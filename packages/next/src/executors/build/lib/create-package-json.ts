import { ExecutorContext } from '@nrwl/devkit';

import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { writeJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { createPackageJson as generatePackageJson } from '@nrwl/workspace/src/utilities/create-package-json';

import { NextBuildBuilderOptions } from '../../../utils/types';

export function createPackageJson(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const depGraph = createProjectGraph();
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
    packageJson.devDependencies['@nrwl/workspace'] =
      nrwlWorkspaceNode.data.version;
  }
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
