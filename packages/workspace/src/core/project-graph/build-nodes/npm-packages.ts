import { AddProjectNode, ProjectGraphContext } from '../project-graph-models';
import { readJsonFile } from '@nrwl/devkit';
import { join } from 'path';
import { appRootPath } from '../../../utilities/app-root';

export function buildNpmPackageNodes(
  ctx: ProjectGraphContext,
  addNode: AddProjectNode
) {
  const packageJson = readJsonFile(join(appRootPath, 'package.json'));
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  Object.keys(deps).forEach((d) => {
    addNode({
      type: 'npm',
      name: `npm:${d}`,
      data: {
        version: deps[d],
        packageName: d,
        files: [],
      },
    });
  });
}
