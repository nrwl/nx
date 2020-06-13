import { Task } from './tasks-runner';
import { ProjectGraphNode } from '../core/project-graph';

const commonCommands = ['build', 'test', 'lint', 'e2e', 'deploy'];

export function getCommandAsString(
  cliCommand: string,
  isYarn: boolean,
  task: Task
) {
  return getCommand(cliCommand, isYarn, task).join(' ').trim();
}

export function getCommand(cliCommand: string, isYarn: boolean, task: Task) {
  const args = Object.entries(task.overrides || {}).map(
    ([prop, value]) => `--${prop}=${value}`
  );

  if (commonCommands.includes(task.target.target)) {
    const config = task.target.configuration
      ? [`--configuration`, task.target.configuration]
      : [];

    return [
      cliCommand,
      ...(isYarn ? [] : ['--']),
      task.target.target,
      task.target.project,
      ...config,
      ...args,
    ];
  } else {
    const config = task.target.configuration
      ? `:${task.target.configuration} `
      : '';

    return [
      cliCommand,
      ...(isYarn ? [] : ['--']),
      'run',
      `${task.target.project}:${task.target.target}${config}`,
      ...args,
    ];
  }
}

export function getOutputs(p: Record<string, ProjectGraphNode>, task: Task) {
  return getOutputsForTargetAndConfiguration(task, p[task.target.project]);
}

export function getOutputsForTargetAndConfiguration(
  task: Pick<Task, 'target' | 'overrides'>,
  node: ProjectGraphNode
) {
  if (task.overrides?.outputPath) {
    return [task.overrides?.outputPath];
  }
  const { target, configuration } = task.target;
  const architect = node.data.architect[target];
  if (architect && architect.outputs) return architect.outputs;

  let opts = architect.options || {};
  if (architect.configurations && architect.configurations[configuration]) {
    opts = {
      ...opts,
      ...architect.configurations[configuration],
    };
  }

  if (opts.outputPath) {
    return Array.isArray(opts.outputPath) ? opts.outputPath : [opts.outputPath];
  } else if (target === 'build') {
    return [`dist/${node.data.root}`];
  } else {
    return [];
  }
}
