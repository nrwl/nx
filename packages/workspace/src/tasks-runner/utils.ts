import { Task } from './tasks-runner';
import { ProjectGraphNode } from '../core/project-graph';
import * as flatten from 'flat';
import * as _ from 'lodash';

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
  const { target, configuration } = task.target;

  const targets = node.data.targets[target];

  const options = {
    ...targets.options,
    ...targets?.configurations?.[configuration],
    ...task.overrides,
  };

  if (targets?.outputs) {
    return targets.outputs.map((output) =>
      _.template(output, { interpolate: /{([\s\S]+?)}/g })({ options })
    );
  }

  // Keep backwards compatibility in case `outputs` doesn't exist
  if (options.outputPath) {
    return Array.isArray(options.outputPath)
      ? options.outputPath
      : [options.outputPath];
  } else if (target === 'build' || target === 'prepare') {
    return [
      `dist/${node.data.root}`,
      `${node.data.root}/dist`,
      `${node.data.root}/build`,
      `${node.data.root}/public`,
    ];
  } else {
    return [];
  }
}

export function unparse(options: Object): string[] {
  const unparsed = [];
  for (const key of Object.keys(options)) {
    const value = options[key];
    unparseOption(key, value, unparsed);
  }

  return unparsed;
}

function unparseOption(key: string, value: any, unparsed: string[]) {
  if (value === true) {
    unparsed.push(`--${key}`);
  } else if (value === false) {
    unparsed.push(`--no-${key}`);
  } else if (Array.isArray(value)) {
    value.forEach((item) => unparseOption(key, item, unparsed));
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    const flattened = flatten(value, { safe: true });
    for (const flattenedKey in flattened) {
      unparseOption(
        `${key}.${flattenedKey}`,
        flattened[flattenedKey],
        unparsed
      );
    }
  } else if (typeof value === 'string' && value.includes(' ')) {
    unparsed.push(`--${key}="${value}"`);
  } else if (value != null) {
    unparsed.push(`--${key}=${value}`);
  }
}
