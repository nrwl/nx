import { join } from 'path';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { readJsonFile } from 'nx/src/utils/fileutils';
import { ProjectGraphBuilder } from '../project-graph-builder';

export function buildNpmPackageNodes(builder: ProjectGraphBuilder) {
  const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  Object.keys(deps).forEach((d) => {
    builder.addExternalNode({
      type: 'npm',
      name: `npm:${d}`,
      data: {
        version: deps[d],
        packageName: d,
      },
    });
  });
}
