import * as stripJsonComments from 'strip-json-comments';
import { ProjectGraphContext, AddProjectNode } from '../project-graph-models';
import { FileRead } from '../../file-utils';

export function buildNpmPackageNodes(
  ctx: ProjectGraphContext,
  addNode: AddProjectNode,
  fileRead: FileRead
) {
  const packageJson = JSON.parse(stripJsonComments(fileRead('package.json')));
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
