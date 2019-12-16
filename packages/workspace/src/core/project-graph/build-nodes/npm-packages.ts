import * as stripJsonComments from 'strip-json-comments';
import { ProjectGraphContext, AddProjectNode } from '../project-graph-models';

export function buildNpmPackageNodes(
  ctx: ProjectGraphContext,
  addNode: AddProjectNode,
  fileRead: (s: string) => string
) {
  const packageJson = JSON.parse(stripJsonComments(fileRead('package.json')));
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  Object.keys(deps).forEach(d => {
    addNode({
      type: 'npm',
      name: d,
      data: {
        version: deps[d],
        files: []
      }
    });
  });
}
