import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { ProjectGraphBuilder } from '../project-graph-builder';

export function applyImplicitDependencies(
  projects: Record<string, ProjectConfiguration>,
  builder: ProjectGraphBuilder
) {
  // Use for...in to avoid Object.keys() array creation
  for (const source in projects) {
    const p = projects[source];
    const deps = p.implicitDependencies;
    if (deps && deps.length > 0) {
      for (const target of deps) {
        if (target.startsWith('!')) {
          builder.removeDependency(source, target.slice(1));
        } else {
          builder.addImplicitDependency(source, target);
        }
      }
    }
  }
}
