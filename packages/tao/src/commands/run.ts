import { Architect } from '@angular-devkit/architect';
import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';
import {
  json,
  JsonObject,
  logging,
  schema,
  terminal,
  workspaces,
} from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { WorkspaceDefinition } from '@angular-devkit/core/src/workspace';
import * as minimist from 'minimist';
import { getLogger } from '../shared/logger';
import {
  coerceTypes,
  convertAliases,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { commandName, printHelp } from '../shared/print-help';

export interface RunOptions {
  project: string;
  target: string;
  configuration: string;
  help: boolean;
  runOptions: Options;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the project name and the target (e.g., ${commandName} run proj:build)`
  );
}

function parseRunOpts(
  args: string[],
  defaultProjectName: string | null,
  logger: logging.Logger
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
      `No project name specified. Using default project : ${terminal.bold(
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

function printRunHelp(
  opts: RunOptions,
  schema: Schema,
  logger: logging.Logger
) {
  printHelp(
    `${commandName} run ${opts.project}:${opts.target}`,
    schema,
    logger
  );
}

export function validateTargetAndConfiguration(
  workspace: WorkspaceDefinition,
  opts: RunOptions
) {
  const architect = workspace.projects.get(opts.project);
  if (!architect) {
    throw new Error(`Could not find project "${opts.project}"`);
  }
  const targets = architect.targets;

  const availableTargets = [...targets.keys()];
  const target = targets.get(opts.target);
  if (!target) {
    throw new Error(
      `Could not find target "${opts.target}" in the ${
        opts.project
      } project. Valid targets are: ${terminal.bold(
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

function normalizeOptions(opts: Options, schema: Schema): Options {
  return convertAliases(coerceTypes(opts, schema), schema, false);
}

export async function run(root: string, args: string[], isVerbose: boolean) {
  const logger = getLogger(isVerbose);

  return handleErrors(logger, isVerbose, async () => {
    const fsHost = new NodeJsSyncHost();
    const { workspace } = await workspaces.readWorkspace(
      'workspace.json',
      workspaces.createWorkspaceHost(fsHost)
    );

    const opts = parseRunOpts(
      args,
      workspace.extensions['defaultProject'] as string,
      logger
    );
    validateTargetAndConfiguration(workspace, opts);

    const registry = new json.schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    const architectHost = new WorkspaceNodeModulesArchitectHost(
      workspace,
      root
    );
    const architect = new Architect(architectHost, registry);

    const builderConf = await architectHost.getBuilderNameForTarget({
      project: opts.project,
      target: opts.target,
    });
    const builderDesc = await architectHost.resolveBuilder(builderConf);
    const flattenedSchema = await registry
      .flatten(builderDesc.optionSchema as json.JsonObject)
      .toPromise();

    if (opts.help) {
      printRunHelp(opts, flattenedSchema as Schema, logger);
      return 0;
    }

    const runOptions = normalizeOptions(
      opts.runOptions,
      flattenedSchema as Schema
    );
    const run = await architect.scheduleTarget(
      {
        project: opts.project,
        target: opts.target,
        configuration: opts.configuration,
      },
      runOptions as JsonObject,
      { logger }
    );
    const result = await run.output.toPromise();
    await run.stop();
    return result.success ? 0 : 1;
  });
}
