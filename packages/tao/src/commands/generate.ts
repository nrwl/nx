import {
  experimental,
  JsonObject,
  logging,
  normalize,
  schema,
  tags,
  terminal,
  virtualFs
} from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import {
  DryRunEvent,
  formats,
  HostTree,
  Schematic
} from '@angular-devkit/schematics';
import {
  NodeWorkflow,
  validateOptionsWithSchema
} from '@angular-devkit/schematics/tools';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import { detectPackageManager } from '../shared/detect-package-manager';
import { getLogger } from '../shared/logger';
import {
  convertToCamelCase,
  handleErrors,
  Schema,
  validateOptions
} from '../shared/params';
import { commandName, printHelp } from '../shared/print-help';
import minimist = require('minimist');

interface GenerateOptions {
  collectionName: string;
  schematicName: string;
  schematicOptions: { [k: string]: string };
  help: boolean;
  debug: boolean;
  dryRun: boolean;
  force: boolean;
  interactive: boolean;
  defaults: boolean;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the schematic name (e.g., ${commandName} generate collection-name:schematic-name)`
  );
}

function parseGenerateOpts(
  args: string[],
  mode: 'generate' | 'new',
  defaultCollection: string | null
): GenerateOptions {
  const schematicOptions = convertToCamelCase(
    minimist(args, {
      boolean: ['help', 'dryRun', 'debug', 'force', 'interactive'],
      alias: {
        dryRun: 'dry-run'
      },
      default: {
        debug: false,
        dryRun: false,
        interactive: true
      }
    })
  );

  let collectionName = null;
  let schematicName = null;
  if (mode === 'generate') {
    if (!schematicOptions['_'] || schematicOptions['_'].length === 0) {
      throwInvalidInvocation();
    }
    [collectionName, schematicName] = schematicOptions['_'].shift()!.split(':');
    if (!schematicName) {
      schematicName = collectionName;
      collectionName = defaultCollection;
    }
  } else {
    collectionName = schematicOptions.collection;
    schematicName = '';
  }

  if (!collectionName) {
    throwInvalidInvocation();
  }

  const res = {
    collectionName,
    schematicName,
    schematicOptions,
    help: schematicOptions.help,
    debug: schematicOptions.debug,
    dryRun: schematicOptions.dryRun,
    force: schematicOptions.force,
    interactive: schematicOptions.interactive,
    defaults: schematicOptions.defaults
  };

  delete schematicOptions.debug;
  delete schematicOptions.dryRun;
  delete schematicOptions.force;
  delete schematicOptions.interactive;
  delete schematicOptions.defaults;
  delete schematicOptions.help;
  delete schematicOptions['--'];
  return res;
}

function createRecorder(record: any, logger: logging.Logger) {
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

async function createWorkflow(
  fsHost: virtualFs.Host<fs.Stats>,
  root: string,
  opts: GenerateOptions
) {
  const workflow = new NodeWorkflow(fsHost, {
    force: opts.force,
    dryRun: opts.dryRun,
    packageManager: await detectPackageManager(fsHost),
    root: normalize(root),
    registry: new schema.CoreSchemaRegistry(formats.standardFormats)
  });
  const _params = opts.schematicOptions._;
  delete opts.schematicOptions._;
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
      (definitions: Array<schema.PromptDefinition>) => {
        const questions: inquirer.Questions = definitions.map(definition => {
          const question = {
            name: definition.id,
            message: definition.message,
            default: definition.default as any
          } as any;

          const validator = definition.validator;
          if (validator) {
            question.validate = (input: any) => validator(input);
          }

          switch (definition.type) {
            case 'confirmation':
              question.type = 'confirm';
              break;
            case 'list':
              question.type = !!definition.multiselect ? 'checkbox' : 'list';
              question.choices =
                definition.items &&
                definition.items.map(item => {
                  if (typeof item == 'string') {
                    return item;
                  } else {
                    return {
                      name: item.label,
                      value: item.value
                    };
                  }
                });
              break;
            default:
              question.type = definition.type;
              break;
          }
          return question;
        });

        return inquirer.prompt(questions);
      }
    );
  }
  return workflow;
}

function getCollection(workflow: NodeWorkflow, name: string) {
  const collection = workflow.engine.createCollection(name);
  if (!collection) throw new Error(`Cannot find collection '${name}'`);
  return collection;
}

function printGenHelp(
  opts: GenerateOptions,
  schema: Schema,
  logger: logging.Logger
) {
  printHelp(
    `${commandName} generate ${opts.collectionName}:${opts.schematicName}`,
    {
      ...schema,
      properties: {
        ...schema.properties,
        dryRun: `Runs through and reports activity without writing to disk.`
      }
    },
    logger
  );
}

async function getSchematicDefaults(
  root: string,
  collection: string,
  schematic: string
) {
  const workspace = await new experimental.workspace.Workspace(
    normalize(root) as any,
    new NodeJsSyncHost()
  )
    .loadWorkspaceFromHost('workspace.json' as any)
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
  schematic: Schematic<any, any>,
  allowAdditionalArgs: boolean = false
): Promise<number> {
  const flattenedSchema = (await workflow.registry
    .flatten(schematic.description.schemaJson!)
    .toPromise()) as Schema;

  if (opts.help) {
    printGenHelp(opts, flattenedSchema as any, logger);
    return 0;
  }

  const defaults =
    opts.schematicName === 'tao-new'
      ? {}
      : await getSchematicDefaults(
          root,
          opts.collectionName,
          opts.schematicName
        );
  const record = { loggingQueue: [] as string[], error: false };
  workflow.reporter.subscribe(createRecorder(record, logger));

  const schematicOptions = validateOptions(
    opts.schematicOptions,
    flattenedSchema
  );

  if (schematicOptions['--'] && !allowAdditionalArgs) {
    schematicOptions['--'].forEach(unmatched => {
      const message =
        `Could not match option '${unmatched.name}' to the ${opts.collectionName}:${opts.schematicName} schema.` +
        (unmatched.possible.length > 0
          ? ` Possible matches : ${unmatched.possible.join()}`
          : '');
      logger.fatal(message);
    });

    return 1;
  }

  await workflow
    .execute({
      collection: opts.collectionName,
      schematic: opts.schematicName,
      options: { ...defaults, ...schematicOptions },
      debug: opts.debug,
      logger
    })
    .toPromise();

  if (!record.error) {
    record.loggingQueue.forEach(log => logger.info(log));
  }

  if (opts.dryRun) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  }
  return 0;
}

export async function generate(
  root: string,
  args: string[],
  isVerbose: boolean = false
) {
  const logger = getLogger(isVerbose);

  return handleErrors(logger, isVerbose, async () => {
    const fsHost = new virtualFs.ScopedHost(
      new NodeJsSyncHost(),
      normalize(root)
    );
    const opts = parseGenerateOpts(
      args,
      'generate',
      await readDefaultCollection(fsHost)
    );

    const workflow = await createWorkflow(fsHost, root, opts);
    const collection = getCollection(workflow, opts.collectionName);
    const schematic = collection.createSchematic(opts.schematicName, true);
    return runSchematic(
      root,
      workflow,
      logger,
      { ...opts, schematicName: schematic.description.name },
      schematic
    );
  });
}

async function readDefaultCollection(host: virtualFs.Host<any>) {
  const workspaceJson = JSON.parse(
    new HostTree(host).read('workspace.json')!.toString()
  );
  return workspaceJson.cli ? workspaceJson.cli.defaultCollection : null;
}

export async function taoNew(
  root: string,
  args: string[],
  isVerbose: boolean = false
) {
  const logger = getLogger(isVerbose);

  return handleErrors(logger, isVerbose, async () => {
    const fsHost = new virtualFs.ScopedHost(
      new NodeJsSyncHost(),
      normalize(root)
    );
    const opts = parseGenerateOpts(args, 'new', null);
    const workflow = await createWorkflow(fsHost, root, opts);
    const collection = getCollection(workflow, opts.collectionName);
    const schematic = collection.createSchematic('tao-new', true);
    const allowAdditionalArgs = true; // tao-new is a special case, we can't yet know the schema to validate against
    return runSchematic(
      root,
      workflow,
      logger,
      { ...opts, schematicName: schematic.description.name },
      schematic,
      allowAdditionalArgs
    );
  });
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}
