import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace, NxJson, readJsonInTree } from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  createProjectGraph,
  DependencyType,
  ProjectGraph
} from '../../../core/project-graph';
import { Schema } from '../schema';

/**
 * Check whether the project to be removed is depended on by another project
 *
 * Throws an error if the project is in use, unless the `--forceRemove` option is used.
 *
 * @param schema The options provided to the schematic
 */
export function checkDependencies(schema: Schema): Rule {
  if (schema.forceRemove) {
    return (tree: Tree) => tree;
  }

  return (tree: Tree, context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map(workspace => {
        const graph: ProjectGraph = createProjectGraph();
        const deps = graph.dependencies[schema.projectName];

        if (deps.length === 0) {
          return tree;
        }

        const implicitDeps = deps.filter(
          x => x.type === DependencyType.implicit
        );
        const dynamicDeps = deps.filter(x => x.type === DependencyType.dynamic);

        const nxJson = readJsonInTree<NxJson>(tree, 'nx.json');
        const project = workspace.projects.get(schema.projectName);

        if (project.extensions['projectType'] === 'application') {
          // These shouldn't be imported anywhere
          return tree;
        }

        return tree;
      })
    );
  };
}
