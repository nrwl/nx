import { Task } from './tasks-runner';
import { ProjectGraphNode } from '../core/project-graph';

const commonCommands = ['build', 'test', 'lint', 'e2e', 'deploy'];

export function getCommandAsString(
  cliCommand: string,
  isYarn: boolean,
  task: Task
) {
  return getCommand(cliCommand, isYarn, task)
    .join(' ')
    .trim();
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
      ...args
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
      ...args
    ];
  }
}

export function getOutputs(p: Record<string, ProjectGraphNode>, task: Task) {
  const architect = p[task.target.project].data.architect[task.target.target];
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
