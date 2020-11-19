import * as minimist from 'minimist';
import { getLogger } from '../shared/logger';
import {
  combineOptionsForBuilder,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { printHelp } from '../shared/print-help';
import {
  TargetDefinition,
  WorkspaceDefinition,
  Workspaces,
} from '../shared/workspace';

const chalk = require('chalk');

export interface RunOptions {
  project: string;
  target: string;
  configuration: string;
  help: boolean;
  runOptions: Options;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the project name and the target (e.g., nx run proj:build)`
  );
}

function parseRunOpts(
  args: string[],
  defaultProjectName: string | null,
  logger: Console
): RunOptions {
  const runOptions = convertToCamelCase(
    minimist(args, {
      boolean: ['help', 'prod'],
      string: ['configuration', 'project'],
    })
  );
  const help = runOptions.help as boolean;
  if (!runOptions._ || !runOptions._[0]) {
    throwInvalidInvocation();
  }
  // eslint-disable-next-line prefer-const
  let [project, target, configuration]: [
    string,
    string,
    string
  ] = runOptions._[0].split(':');
  if (!project && defaultProjectName) {
    logger.debug(
      `No project name specified. Using default project : ${chalk.default.bold(
        defaultProjectName
      )}`
    );
    project = defaultProjectName;
  }
  if (runOptions.configuration) {
    configuration = runOptions.configuration as string;
  }
  if (runOptions.prod) {
    configuration = 'production';
  }
  if (runOptions.project) {
    project = runOptions.project as string;
  }
  if (!project || !target) {
    throwInvalidInvocation();
  }
  const res = { project, target, configuration, help, runOptions };
  delete runOptions['help'];
  delete runOptions['_'];
  delete runOptions['configuration'];
  delete runOptions['prod'];
  delete runOptions['project'];

  return res;
}

export function printRunHelp(
  opts: RunOptions,
  schema: Schema,
  logger: Console
) {
  printHelp(`nx run ${opts.project}:${opts.target}`, schema, logger as any);
}

export function validateTargetAndConfiguration(
  workspace: WorkspaceDefinition,
  opts: RunOptions
) {
  const project = workspace.projects[opts.project];
  if (!project) {
    throw new Error(`Could not find project "${opts.project}"`);
  }
  const target = project.architect[opts.target];
  const availableTargets = Object.keys(project.architect);
  if (!target) {
    throw new Error(
      `Could not find target "${opts.target}" in the ${
        opts.project
      } project. Valid targets are: ${chalk.default.bold(
        availableTargets.join(', ')
      )}`
    );
  }

  // Not all targets have configurations
  // and an undefined configuration is valid
  if (opts.configuration) {
    if (target.configurations) {
      const configuration = target.configurations[opts.configuration];
      if (!configuration) {
        throw new Error(
          `Could not find configuration "${opts.configuration}" in ${
            opts.project
          }:${opts.target}. Valid configurations are: ${Object.keys(
            target.configurations
          ).join(', ')}`
        );
      }
    } else {
      throw new Error(
        `No configurations are defined for ${opts.project}:${opts.target}, so "${opts.configuration}" is invalid.`
      );
    }
  }
}

export interface TargetContext {
  root: string;
  target: TargetDefinition;
  workspace: WorkspaceDefinition;
}

export async function run(root: string, args: string[], isVerbose: boolean) {
  const logger = getLogger(isVerbose) as any;
  const ws = new Workspaces();

  return handleErrors(logger, isVerbose, async () => {
    const workspace = ws.readWorkspaceConfiguration(root);
    const opts = parseRunOpts(args, workspace.defaultProject, logger);
    validateTargetAndConfiguration(workspace, opts);

    const target = workspace.projects[opts.project].architect[opts.target];
    if (ws.isNxBuilder(target)) {
      const { schema, implementation } = ws.readBuilder(target);
      const combinedOptions = combineOptionsForBuilder(
        opts.runOptions,
        opts.configuration,
        target,
        schema
      );
      if (opts.help) {
        printRunHelp(opts, schema, logger);
        return 0;
      }
      return await implementation(combinedOptions, { root, target, workspace });
    } else {
      return (await import('./ngcli-adapter')).run(logger, root, opts);
    }
  });
}
