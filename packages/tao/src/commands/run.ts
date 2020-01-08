import { Architect } from '@angular-devkit/architect';
import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';
import {
  experimental,
  json,
  logging,
  normalize,
  schema,
  terminal
} from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { getLogger } from '../shared/logger';
import {
  coerceTypes,
  convertToCamelCase,
  handleErrors,
  Schema
} from '../shared/params';
import { commandName, printHelp } from '../shared/print-help';
import minimist = require('minimist');

export interface RunOptions {
  project: string;
  target: string;
  configuration: string;
  help: boolean;
  runOptions: { [k: string]: any };
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
      string: ['configuration', 'project']
    })
  );
  const help = runOptions.help;
  if (!runOptions._ || !runOptions._[0]) {
    throwInvalidInvocation();
  }
  let [project, target, configuration] = runOptions._[0].split(':');
  if (!project && defaultProjectName) {
    logger.debug(
      `No project name specified. Using default project : ${terminal.bold(
        defaultProjectName
      )}`
    );
    project = defaultProjectName;
  }
  if (runOptions.configuration) {
    configuration = runOptions.configuration;
  }
  if (runOptions.prod) {
    configuration = 'production';
  }
  if (runOptions.project) {
    project = runOptions.project;
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
  workspace: experimental.workspace.Workspace,
  opts: RunOptions
) {
  const targets = workspace.getProjectTargets(opts.project);

  const target = targets[opts.target];
  if (!target) {
    throw new Error(
      `Could not find target "${opts.target}" in the ${
        opts.project
      } project. Valid targets are: ${terminal.bold(
        Object.keys(targets).join(', ')
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

export async function run(root: string, args: string[], isVerbose: boolean) {
  const logger = getLogger(isVerbose);

  return handleErrors(logger, isVerbose, async () => {
    const fsHost = new NodeJsSyncHost();
    const workspace = await new experimental.workspace.Workspace(
      normalize(root) as any,
      fsHost
    )
      .loadWorkspaceFromHost('workspace.json' as any)
      .toPromise();

    const opts = parseRunOpts(args, workspace.getDefaultProjectName(), logger);
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
      target: opts.target
    });
    const builderDesc = await architectHost.resolveBuilder(builderConf);
    const flattenedSchema = await registry
      .flatten(builderDesc.optionSchema! as json.JsonObject)
      .toPromise();

    if (opts.help) {
      printRunHelp(opts, flattenedSchema as any, logger);
      return 0;
    }

    const runOptions = coerceTypes(opts.runOptions, flattenedSchema as any);
    const run = await architect.scheduleTarget(
      {
        project: opts.project,
        target: opts.target,
        configuration: opts.configuration
      },
      runOptions,
      { logger }
    );
    const result = await run.output.toPromise();
    await run.stop();
    return result.success ? 0 : 1;
  });
}
