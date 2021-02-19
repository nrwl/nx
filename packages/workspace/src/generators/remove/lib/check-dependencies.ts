import { Tree } from '@nrwl/devkit';
import {
  onlyWorkspaceProjects,
  ProjectGraph,
  reverse,
} from '../../../core/project-graph';
import { Schema } from '../schema';
import { createProjectGraphFromTree } from '../../../utilities/create-project-graph-from-tree';

/**
 * Check whether the project to be removed is depended on by another project
 *
 * Throws an error if the project is in use, unless the `--forceRemove` option is used.
 */
export function checkDependencies(tree: Tree, schema: Schema) {
  if (schema.forceRemove) {
    return;
  }

  const graph: ProjectGraph = createProjectGraphFromTree(tree);

  const reverseGraph = onlyWorkspaceProjects(reverse(graph));

  const deps = reverseGraph.dependencies[schema.projectName] || [];

  if (deps.length === 0) {
    return;
  }

  throw new Error(
    `${
      schema.projectName
    } is still depended on by the following projects:\n${deps
      .map((x) => x.target)
      .join('\n')}`
  );
}
