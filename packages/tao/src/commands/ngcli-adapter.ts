import { Architect } from '@angular-devkit/architect';
import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';
import {
  experimental,
  json,
  JsonObject,
  logging,
  normalize,
  Path,
  schema,
  tags,
  terminal,
  virtualFs,
  workspaces,
} from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import {
  coerceTypesInOptions,
  convertAliases,
  Options,
  Schema,
} from '../shared/params';
import { printRunHelp, RunOptions } from './run';
import {
  FileSystemCollectionDescription,
  FileSystemSchematicDescription,
  NodeWorkflow,
  validateOptionsWithSchema,
} from '@angular-devkit/schematics/tools';
import { DryRunEvent, formats, Schematic } from '@angular-devkit/schematics';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import { detectPackageManager } from '../shared/detect-package-manager';
import { GenerateOptions, printGenHelp } from './generate';
import * as taoTree from '../shared/tree';
import { workspaceConfigName } from '@nrwl/tao/src/shared/workspace';

function normalizeOptions(opts: Options, schema: Schema): Options {
  return convertAliases(coerceTypesInOptions(opts, schema), schema, false);
}

export async function run(logger: any, root: string, opts: RunOptions) {
  const fsHost = new NodeJsSyncHost();
  const { workspace } = await workspaces.readWorkspace(
    workspaceConfigName(root),
    workspaces.createWorkspaceHost(fsHost)
  );

  const registry = new json.schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const architectHost = new WorkspaceNodeModulesArchitectHost(workspace, root);
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
}

async function createWorkflow(
  fsHost: virtualFs.Host<fs.Stats>,
  root: string,
  opts: any
) {
  const workflow = new NodeWorkflow(fsHost, {
    force: opts.force,
    dryRun: opts.dryRun,
    packageManager: detectPackageManager(),
    root: normalize(root),
    registry: new schema.CoreSchemaRegistry(formats.standardFormats),
    resolvePaths: [process.cwd(), root],
  });
  const _params = opts.generatorOptions._;
  delete opts.generatorOptions._;
  workflow.registry.addSmartDefaultProvider('argv', (schema: JsonObject) => {
    if ('index' in schema) {
      return _params[Number(schema['index'])];
    } else {
      return _params;
    }
  });

  if (opts.defaults) {
    workflow.registry.addPreTransform(schema.transforms.addUndefinedDefaults);
  } else {
    workflow.registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  }

  workflow.engineHost.registerOptionsTransform(
    validateOptionsWithSchema(workflow.registry)
  );

  if (opts.interactive !== false && isTTY()) {
    workflow.registry.usePromptProvider(
      (definitions: schema.PromptDefinition[]) => {
        const questions: inquirer.QuestionCollection = definitions.map(
          (definition) => {
            const question = {
              name: definition.id,
              message: definition.message,
              default: definition.default as
                | string
                | number
                | boolean
                | string[],
            } as inquirer.Question;

            const validator = definition.validator;
            if (validator) {
              question.validate = (input) => validator(input);
            }

            switch (definition.type) {
              case 'confirmation':
                question.type = 'confirm';
                break;
              case 'list':
                question.type = definition.multiselect ? 'checkbox' : 'list';
                question.choices =
                  definition.items &&
                  definition.items.map((item) => {
                    if (typeof item == 'string') {
                      return item;
                    } else {
                      return {
                        name: item.label,
                        value: item.value,
                      };
                    }
                  });
                break;
              default:
                question.type = definition.type;
                break;
            }
            return question;
          }
        );

        return inquirer.prompt(questions);
      }
    );
  }
  return workflow;
}

function getCollection(workflow: any, name: string) {
  const collection = workflow.engine.createCollection(name);
  if (!collection) throw new Error(`Cannot find collection '${name}'`);
  return collection;
}

function createRecorder(
  record: {
    loggingQueue: string[];
    error: boolean;
  },
  logger: logging.Logger
) {
  return (event: DryRunEvent) => {
    const eventPath = event.path.startsWith('/')
      ? event.path.substr(1)
      : event.path;
    if (event.kind === 'error') {
      record.error = true;
      logger.warn(
        `ERROR! ${eventPath} ${
          event.description == 'alreadyExist'
            ? 'already exists'
            : 'does not exist.'
        }.`
      );
    } else if (event.kind === 'update') {
      record.loggingQueue.push(
        tags.oneLine`${terminal.white('UPDATE')} ${eventPath} (${
          event.content.length
        } bytes)`
      );
    } else if (event.kind === 'create') {
      record.loggingQueue.push(
        tags.oneLine`${terminal.green('CREATE')} ${eventPath} (${
          event.content.length
        } bytes)`
      );
    } else if (event.kind === 'delete') {
      record.loggingQueue.push(`${terminal.yellow('DELETE')} ${eventPath}`);
    } else if (event.kind === 'rename') {
      record.loggingQueue.push(
        `${terminal.blue('RENAME')} ${eventPath} => ${event.to}`
      );
    }
  };
}

async function getSchematicDefaults(
  root: string,
  collection: string,
  schematic: string
) {
  const workspace = await new experimental.workspace.Workspace(
    normalize(root) as Path,
    new NodeJsSyncHost()
  )
    .loadWorkspaceFromHost(workspaceConfigName(root) as any)
    .toPromise();

  let result = {};
  if (workspace.getSchematics()) {
    const schematicObject = workspace.getSchematics()[
      `${collection}:${schematic}`
    ];
    if (schematicObject) {
      result = { ...result, ...(schematicObject as {}) };
    }
    const collectionObject = workspace.getSchematics()[collection];
    if (
      typeof collectionObject == 'object' &&
      !Array.isArray(collectionObject)
    ) {
      result = { ...result, ...(collectionObject[schematic] as {}) };
    }
  }
  return result;
}

async function runSchematic(
  root: string,
  workflow: NodeWorkflow,
  logger: logging.Logger,
  opts: GenerateOptions,
  schematic: Schematic<
    FileSystemCollectionDescription,
    FileSystemSchematicDescription
  >,
  allowAdditionalArgs = false,
  printDryRunMessage = true,
  recorder: any = null
): Promise<{ status: number; loggingQueue: string[] }> {
  const flattenedSchema = (await workflow.registry
    .flatten(schematic.description.schemaJson)
    .toPromise()) as Schema;

  if (opts.help) {
    printGenHelp(opts, flattenedSchema as Schema, logger as any);
    return { status: 0, loggingQueue: [] };
  }

  const defaults =
    opts.generatorName === 'tao-new' || opts.generatorName === 'ng-new'
      ? {}
      : await getSchematicDefaults(
          root,
          opts.collectionName,
          opts.generatorName
        );
  const record = { loggingQueue: [] as string[], error: false };
  workflow.reporter.subscribe(recorder || createRecorder(record, logger));

  const schematicOptions = normalizeOptions(
    opts.generatorOptions,
    flattenedSchema
  );

  if (schematicOptions['--'] && !allowAdditionalArgs) {
    schematicOptions['--'].forEach((unmatched) => {
      const message =
        `Could not match option '${unmatched.name}' to the ${opts.collectionName}:${opts.generatorName} schema.` +
        (unmatched.possible.length > 0
          ? ` Possible matches : ${unmatched.possible.join()}`
          : '');
      logger.fatal(message);
    });

    return { status: 1, loggingQueue: [] };
  }

  await workflow
    .execute({
      collection: opts.collectionName,
      schematic: opts.generatorName,
      options: { ...defaults, ...schematicOptions },
      debug: opts.debug,
      logger,
    })
    .toPromise();

  if (!record.error) {
    record.loggingQueue.forEach((log) => logger.info(log));
  }

  if (opts.dryRun && printDryRunMessage) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  }
  return { status: 0, loggingQueue: record.loggingQueue };
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}

export async function generate(
  logger: logging.Logger,
  root: string,
  opts: GenerateOptions
) {
  const fsHost = new virtualFs.ScopedHost(
    new NodeJsSyncHost(),
    normalize(root)
  );
  const workflow = await createWorkflow(fsHost, root, opts);
  const collection = getCollection(workflow, opts.collectionName);
  const schematic = collection.createSchematic(opts.generatorName, true);
  return (
    await runSchematic(
      root,
      workflow,
      logger,
      { ...opts, generatorName: schematic.description.name },
      schematic
    )
  ).status;
}

export function wrapAngularDevkitSchematic(
  collectionName: string,
  generatorName: string
) {
  return (generatorOptions: { [k: string]: any }) => {
    return async (host: taoTree.Tree) => {
      const emptyLogger = {
        log: (e) => {},
        info: (e) => {},
        warn: (e) => {},
        error: (e) => {},
        fatal: (e) => {},
      } as any;
      emptyLogger.createChild = () => emptyLogger;

      const recorder = (event: DryRunEvent) => {
        const eventPath = event.path.startsWith('/')
          ? event.path.substr(1)
          : event.path;
        if (event.kind === 'error') {
        } else if (event.kind === 'update') {
          host.write(eventPath, event.content);
        } else if (event.kind === 'create') {
          host.write(eventPath, event.content);
        } else if (event.kind === 'delete') {
          host.delete(eventPath);
        } else if (event.kind === 'rename') {
          host.rename(eventPath, event.to);
        }
      };

      const fsHost = new virtualFs.ScopedHost(
        new NodeJsSyncHost(),
        normalize(host.root)
      );

      await Promise.all(
        (host as taoTree.FsTree).listChanges().map(async (c) => {
          if (c.type === 'CREATE' || c.type === 'UPDATE') {
            await fsHost.write(c.path as any, c.content).toPromise();
          } else {
            await fsHost.delete(c.path as any).toPromise();
          }
        })
      );

      const options = {
        generatorOptions: { ...generatorOptions, _: [] },
        dryRun: true,
        interactive: false,
        help: false,
        debug: false,
        collectionName,
        generatorName,
        force: false,
        defaults: false,
      };
      const workflow = await createWorkflow(fsHost, host.root, options);
      const collection = getCollection(workflow, collectionName);
      const schematic = collection.createSchematic(generatorName, true);
      const res = await runSchematic(
        host.root,
        workflow,
        emptyLogger,
        options,
        schematic,
        false,
        false,
        recorder
      );

      if (res.status !== 0) {
        throw new Error(res.loggingQueue.join('\n'));
      }
    };
  };
}

export async function invokeNew(
  logger: logging.Logger,
  root: string,
  opts: GenerateOptions
) {
  const fsHost = new virtualFs.ScopedHost(
    new NodeJsSyncHost(),
    normalize(root)
  );
  const workflow = await createWorkflow(fsHost, root, opts);
  const collection = getCollection(workflow, opts.collectionName);
  const schematic = collection.createSchematic(
    opts.generatorOptions.cli === 'ng' ? 'ng-new' : 'tao-new',
    true
  );
  const allowAdditionalArgs = true; // we can't yet know the schema to validate against
  return (
    await runSchematic(
      root,
      workflow,
      logger,
      { ...opts, generatorName: schematic.description.name },
      schematic,
      allowAdditionalArgs
    )
  ).status;
}
