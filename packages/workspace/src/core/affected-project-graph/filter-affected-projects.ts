import { reverse, ProjectGraph, ProjectGraphBuilder } from '../project-graph';
import { AffectedProjectGraphContext } from './affected-project-graph-models';

export function filterAffectedProjects(
  graph: ProjectGraph,
  ctx: AffectedProjectGraphContext
): ProjectGraph {
  const builder = new ProjectGraphBuilder();
  const reversed = reverse(graph);
  ctx.touchedProjects.forEach(p => {
    addAffectedNodes(p, reversed, builder);
    addAffectedDependencies(p, reversed, builder);
  });
  return builder.build();
}

function addAffectedNodes(
  startingProject: string,
  reversed: ProjectGraph,
  builder: ProjectGraphBuilder
): void {
  builder.addNode(reversed.nodes[startingProject]);
  const ds = reversed.dependencies[startingProject];
  if (ds) {
    ds.forEach(({ target }) => addAffectedNodes(target, reversed, builder));
  }
}

function addAffectedDependencies(
  startingProject: string,
  reversed: ProjectGraph,
  builder: ProjectGraphBuilder
): void {
  if (reversed.dependencies[startingProject]) {
    reversed.dependencies[startingProject].forEach(({ target }) =>
      addAffectedDependencies(target, reversed, builder)
    );
    reversed.dependencies[startingProject].forEach(
      ({ type, source, target }) => {
        // Since source and target was reversed,
        // we need to reverse it back to original direction.
        builder.addDependency(type, target, source);
      }
    );
  }
}
