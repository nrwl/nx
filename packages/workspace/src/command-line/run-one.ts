import { runCommand } from '../tasks-runner/run-command';
import { createProjectGraph } from '../core/project-graph';
import { readEnvironment } from '../core/file-utils';
import { EmptyReporter } from '../tasks-runner/empty-reporter';

export function runOne(opts: {
  project: string;
  target: string;
  configuration: string;
  overrides: any;
}): void {
  const env = readEnvironment(opts.target);
  const projectGraph = createProjectGraph();
  const projects = [projectGraph.nodes[opts.project]];
  runCommand(
    projects,
    projectGraph,
    env,
    opts,
    opts.overrides,
    new EmptyReporter()
  );
}
