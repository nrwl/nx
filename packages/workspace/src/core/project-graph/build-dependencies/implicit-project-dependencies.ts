import {
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';

export function buildImplicitProjectDependencies(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  Object.keys(ctx.workspace.projects).forEach((source) => {
    const p = ctx.workspace.projects[source];
    if (p.implicitDependencies && p.implicitDependencies.length > 0) {
      p.implicitDependencies.forEach((target) => {
        builder.addImplicitDependency(source, target);
      });
    }
  });
}
