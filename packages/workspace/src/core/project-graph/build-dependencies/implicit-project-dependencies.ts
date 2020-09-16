import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';

export function buildImplicitProjectDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency
) {
  Object.keys(ctx.nxJson.projects).forEach((source) => {
    const p = ctx.nxJson.projects[source];
    if (p.implicitDependencies && p.implicitDependencies.length > 0) {
      p.implicitDependencies.forEach((target) => {
        addDependency(DependencyType.implicit, source, target);
      });
    }

    // TODO(v10): remove this because implicit dependencies are generated now..
    if (source.endsWith('-e2e')) {
      const target = source.replace(/-e2e$/, '');
      // Only add if expected source actually exists, otherwise this will error out.
      if (nodes[target]) {
        addDependency(DependencyType.implicit, source, target);
      }
    }
  });
}
