import { AddProjectNode, ProjectGraphContext } from '../project-graph-models';
import { defaultFileRead } from '../../file-utils';
import { parseJsonWithComments } from '../../../utilities/fileutils';

export function buildNpmPackageNodes(
  ctx: ProjectGraphContext,
  addNode: AddProjectNode
) {
  const packageJson = parseJsonWithComments(defaultFileRead('package.json'));
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
