import { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { writeJsonFile } from '@nrwl/workspace/src/utilities/fileutils';

import { BuildNodeBuilderOptions } from './types';
import { createPackageJson } from '@nrwl/workspace/src/utilities/create-package-json';

export function generatePackageJson(
  projectName: string,
  graph: ProjectGraph,
  options: BuildNodeBuilderOptions
) {
  const packageJson = createPackageJson(projectName, graph, options);
  packageJson.main = packageJson.main ?? options.outputFileName;
  delete packageJson.devDependencies;
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
