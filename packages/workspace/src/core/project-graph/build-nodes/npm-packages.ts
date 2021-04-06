import * as stripJsonComments from 'strip-json-comments';
import { AddProjectNode, ProjectGraphContext } from '../project-graph-models';
import { defaultFileRead } from '../../file-utils';

export function buildNpmPackageNodes(
  ctx: ProjectGraphContext,
  addNode: AddProjectNode
) {
  const packageJson = JSON.parse(
    stripJsonComments(defaultFileRead('package.json'))
  );
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
