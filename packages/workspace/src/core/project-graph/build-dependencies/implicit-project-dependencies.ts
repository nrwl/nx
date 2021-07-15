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
  });
}
