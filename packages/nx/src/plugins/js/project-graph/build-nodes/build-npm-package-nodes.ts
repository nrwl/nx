import { existsSync } from 'fs';
import { hashArray } from '../../../../hasher/file-hasher';
import { join } from 'path';

import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import { readJsonFile } from '../../../../utils/fileutils';
import { PackageJson } from '../../../../utils/package-json';
import { workspaceRoot } from '../../../../utils/workspace-root';

export function buildNpmPackageNodes(builder: ProjectGraphBuilder) {
  const packageJsonPath = join(workspaceRoot, 'package.json');
  const packageJson: Partial<PackageJson> = existsSync(packageJsonPath)
    ? readJsonFile(packageJsonPath)
    : {};
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  Object.keys(deps).forEach((d) => {
    if (!builder.graph.externalNodes[`npm:${d}`]) {
      builder.addExternalNode({
        type: 'npm',
        name: `npm:${d}`,
        data: {
          version: deps[d],
          packageName: d,
          hash: hashArray([d, deps[d]]),
        },
      });
    }
  });
}
