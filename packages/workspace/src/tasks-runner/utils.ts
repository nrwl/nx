import { Task } from './tasks-runner';
import { ProjectMap, DependencyGraph } from '../command-line/shared';
import { createTask } from '../command-line/run-tasks/run-command';
import { Target } from '@angular-devkit/architect';

const commonCommands = ['build', 'test', 'lint', 'e2e', 'deploy'];

export function getPreconditions(
  tasks: Task[],
  graph: DependencyGraph
): Task[] {
  const preconditions = new Set<Task>();

  for (let task of tasks) {
    buildPreconditions(task.target, graph, preconditions);
  }

  return Array.from(preconditions);
}

function buildPreconditions(
  target: Target,
  graph: DependencyGraph,
  preconditions: Set<Task>
) {
  const { projects, dependencies } = graph;

  for (let dep of dependencies[target.project]) {
    let next: Target = { ...target, project: dep.projectName };
    buildPreconditions(next, graph, preconditions);

    const project = projects[dep.projectName];
    const task = createTask({
      project,
      target: next.target,
      configuration: next.configuration,
      overrides: next.overrides
    });

    preconditions.add(task);
  }
}

export function getCommand(cliCommand: string, isYarn: boolean, task: Task) {
  const args = Object.entries(task.overrides || {})
    .map(([prop, value]) => `--${prop}=${value}`)
    .join(' ');

  if (commonCommands.includes(task.target.target)) {
    const config = task.target.configuration
      ? `--configuration ${task.target.configuration} `
      : '';
    return `${cliCommand}${isYarn ? '' : ' --'} ${task.target.target} ${
      task.target.project
    } ${config} ${args}`.trim();
  } else {
    const config = task.target.configuration
      ? `:${task.target.configuration} `
      : '';
    return `${cliCommand}${isYarn ? '' : ' --'}  run ${task.target.project}:${
      task.target.target
    }${config} ${args}`.trim();
  }
}

export function getOutputs(p: ProjectMap, task: Task) {
  const architect = p[task.target.project].architect[task.target.target];
  let opts = architect.options || {};
  if (
    architect.configurations &&
    architect.configurations[task.target.configuration]
  ) {
    opts = {
      ...opts,
      ...architect.configurations[task.target.configuration]
    };
  }
  let outputs = [];
  if (opts.outputPath) {
    outputs.push(opts.outputPath);
  }
  return outputs;
}
