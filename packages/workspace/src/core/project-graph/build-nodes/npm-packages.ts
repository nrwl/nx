import { ProjectGraphBuilder, readJsonFile } from '@nrwl/devkit';
import { join } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';

export function buildNpmPackageNodes(builder: ProjectGraphBuilder) {
  const packageJson = readJsonFile(join(appRootPath, 'package.json'));
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
