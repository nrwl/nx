import { output } from '../utils/output';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';

/**
 * Lists available targets for a workspace
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export async function targetsHandler(): Promise<void> {
  const projectGraph: ProjectGraph<ProjectConfiguration> =
    await createProjectGraphAsync({ exitOnError: true });

  const bodyLines: string[] = [];
  for (const [project, { data }] of Object.entries(projectGraph.nodes)) {
    for (const [target, { configurations }] of Object.entries(
      data.targets ?? {}
    )) {
      bodyLines.push(`${project}:${target}`);

      for (const configuration of Object.keys(configurations ?? {})) {
        bodyLines.push(`${project}:${target}:${configuration}`);
      }
    }
  }

  output.log({
    title: `Targets:`,
    bodyLines: bodyLines,
  });
}
