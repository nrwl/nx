import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import { readJsonFile } from '../../../../utils/fileutils';
import { join } from 'path';
import { workspaceRoot } from '../../../../utils/workspace-root';

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
