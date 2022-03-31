import { ProjectGraphProcessorContext } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph-builder';

export function buildImplicitProjectDependencies(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  Object.keys(ctx.workspace.projects).forEach((source) => {
    const p = ctx.workspace.projects[source];
    if (p.implicitDependencies && p.implicitDependencies.length > 0) {
      p.implicitDependencies.forEach((target) => {
        if (target.startsWith('!')) {
          builder.removeDependency(source, target.substr(1));
        } else {
          builder.addImplicitDependency(source, target);
        }
      });
    }
  });
}
