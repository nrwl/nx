import { ProjectGraph } from '../../config/project-graph';
import { InputDefinition } from '../../config/workspace-json-project-json';
import { findMatchingProjects } from '../../utils/find-matching-projects';

/**
 * Producer project -> the projects whose tasks declare a dependency on it
 * *without* a project-graph edge.
 *
 * Two target-configuration shapes create a real dependency the project graph
 * never records, so the reverse walk in `filterAffected` cannot see either:
 *
 *   inputs: [{ input: 'production', projects: ['shared-config'] }]
 *     `gather_project_inputs` resolves the list and inlines those projects'
 *     filesets into this task's plan, so the hash genuinely depends on them.
 *
 *   dependsOn: [{ projects: ['api'], target: 'build' }]
 *     `processTasksForMultipleProjects` builds a task edge to a named project.
 *
 * Both are config reads, cheap next to the planning they gate.
 */
export function buildDeclaredProjectReferences(
  projectGraph: ProjectGraph
): Map<string, Set<string>> {
  const consumersOf = new Map<string, Set<string>>();

  const record = (producers: string[], consumer: string) => {
    for (const producer of producers) {
      if (producer === consumer) continue;
      let consumers = consumersOf.get(producer);
      if (!consumers) {
        consumers = new Set();
        consumersOf.set(producer, consumers);
      }
      consumers.add(consumer);
    }
  };

  for (const [name, node] of Object.entries(projectGraph.nodes)) {
    for (const target of Object.values(node.data.targets ?? {})) {
      for (const input of (target.inputs ?? []) as InputDefinition[]) {
        const projects = (input as { projects?: string | string[] })?.projects;
        if (projects) {
          record(
            findMatchingProjects(toArray(projects), projectGraph.nodes),
            name
          );
        }
      }
      for (const dependency of target.dependsOn ?? []) {
        if (typeof dependency === 'string') continue;
        if (dependency.projects) {
          record(
            findMatchingProjects(
              toArray(dependency.projects),
              projectGraph.nodes
            ),
            name
          );
        }
      }
    }
  }

  return consumersOf;
}

/**
 * Grows a project set until it is closed over declared references. A consumer
 * can itself be named by another project, so one pass is not enough.
 */
export function expandOverDeclaredReferences(
  projects: Set<string>,
  consumersOf: Map<string, Set<string>>
): Set<string> {
  if (!consumersOf.size) return projects;

  const expanded = new Set(projects);
  const queue = [...projects];
  while (queue.length) {
    for (const consumer of consumersOf.get(queue.pop()!) ?? []) {
      if (!expanded.has(consumer)) {
        expanded.add(consumer);
        queue.push(consumer);
      }
    }
  }
  return expanded;
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}
