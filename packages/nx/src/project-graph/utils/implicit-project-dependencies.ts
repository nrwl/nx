import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { ProjectGraphBuilder } from '../project-graph-builder';

export function applyImplicitDependencies(
  projects: Record<string, ProjectConfiguration>,
  builder: ProjectGraphBuilder
) {
  Object.keys(projects).forEach((source) => {
    const p = projects[source];
    if (p.implicitDependencies && p.implicitDependencies.length > 0) {
      p.implicitDependencies.forEach((target) => {
        if (target.startsWith('!')) {
          builder.removeDependency(source, target.slice(1));
        } else {
          builder.addImplicitDependency(source, target);
        }
      });
    }
  });
}
