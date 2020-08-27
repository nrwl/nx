import {
  JsonObject,
  logging,
  normalize,
  schema,
  tags,
  terminal,
  virtualFs,
} from '@angular-devkit/core';
import { createConsoleLogger, NodeJsSyncHost } from '@angular-devkit/core/node';
import {
  formats,
  UnsuccessfulWorkflowExecution,
} from '@angular-devkit/schematics';
import {
  NodeWorkflow,
  validateOptionsWithSchema,
} from '@angular-devkit/schematics/tools';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { copySync, removeSync } from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import { appRootPath } from '../utils/app-root';
import {
  detectPackageManager,
  getPackageManagerExecuteCommand,
} from '../utils/detect-package-manager';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import { output } from '../utils/output';
import { CompilerOptions } from 'typescript';

const rootDirectory = appRootPath;
const collectionName = 'workspace-schematics.json';

type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};

interface ParsedSchematicArgs extends yargs.Arguments {
  interactive: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}
export interface ParsedCommandArgs extends yargs.Arguments {
  /**
   * workspace schematic name
   */
  name?: string;
  /**
   * print available workspace schematics
   */
  listSchematics?: boolean;
  help?: boolean;
}

/**
 * This was previously shipped within `'@angular-devkit/schematics/collection-schema'`
 */
interface CollectionSchematic {
  aliases?: string[];
  /**
   * A description for the schematic
   */
  description: string;
  /**
   * An schematic override. It can be a local schematic or from another collection (in the
   * format 'collection:schematic')
   */
  extends?: string;
  /**
   * A folder or file path to the schematic factory
   */
  factory: string;
  /**
   * Whether or not this schematic should be listed by the tooling. This does not prevent the
   * tooling to run this schematic, just removes its name from listSchematicNames().
   */
  hidden?: boolean;
  /**
   * Whether or not this schematic can be called from an external schematic, or a tool. This
   * implies hidden: true.
   */
  private?: boolean;
  /**
   * Location of the schema.json file of the schematic
   */
  schema?: string;
}

/**
 * This was previously shipped within `'@angular-devkit/schematics/collection-schema'`
 */
interface CollectionSchema {
  extends?: string | string[];
  /**
   * A map of schematic names to schematic details
   */
  schematics: {
    [key: string]: CollectionSchematic;
  };
  version?: string;
}

type SchematicSchema = {
  $schema?: string;
  id?: string;
  title?: string;
  type?: string;
  properties: {
    [p: string]: {
      type: string;
      alias?: string;
      description?: string;
      default?: string | number | boolean | string[];
    };
  };
  required?: string[];
  description?: string;
};

export async function workspaceSchematic(
  args: ParsedCommandArgs,
  rawSchematicArgs: string[]
) {
  const schematicName = args.name;

  const outDir = compileTools();
  const parsedSchematicArgs = parseSchematicOptions(
    rawSchematicArgs,
    getSchematicBooleanProps(schematicName, outDir)
  );
  const logger = createConsoleLogger(
    parsedSchematicArgs.verbose,
    process.stdout,
    process.stderr
  );
  const workflow = createWorkflow(parsedSchematicArgs.dryRun);
  const collectionPath = path.join(outDir, collectionName);
  const collection = getCollection(workflow, collectionPath);

  if (args.listSchematics) {
    return listSchematics(collection, logger);
  }

  if (args.help) {
    const schematic = collection.createSchematic(schematicName, true);
    const flattenedSchema = (await workflow.registry
      .flatten(schematic.description.schemaJson)
      .toPromise()) as SchematicSchema;

    return printGenHelp(flattenedSchema, logger);
  }

  try {
    await executeSchematic(
      schematicName,
      parsedSchematicArgs,
      workflow,
      outDir,
      logger
    );
  } catch (e) {
    process.exit(1);
  }
}

function compileTools() {
  const toolsOutDir = getToolsOutDir();
  removeSync(toolsOutDir);
  compileToolsDir(toolsOutDir);

  const schematicsOutDir = path.join(toolsOutDir, 'schematics');
  const collectionData = constructCollection();
  saveCollection(schematicsOutDir, collectionData);

  return schematicsOutDir;
}

function getToolsOutDir() {
  return path.resolve(toolsDir(), toolsTsConfig().compilerOptions.outDir);
}

function compileToolsDir(outDir: string) {
  copySync(schematicsDir(), path.join(outDir, 'schematics'));

  const tmpTsConfigPath = createTmpTsConfig(toolsTsConfigPath(), {
    include: [path.join(schematicsDir(), '**/*.ts')],
  });

  const packageExec = getPackageManagerExecuteCommand();
  const tsc = `${packageExec} tsc`;
  try {
    execSync(`${tsc} -p ${tmpTsConfigPath}`, {
      stdio: 'inherit',
      cwd: rootDirectory,
    });
  } catch (e) {
    process.exit(1);
  }
}

function constructCollection() {
  const schematics = fs
    .readdirSync(schematicsDir())
    .reduce((acc, schematicName) => {
      const childDir = path.join(schematicsDir(), schematicName);
      const schemaJsonPath = path.join(childDir, 'schema.json');
      if (!exists(schemaJsonPath)) {
        return acc;
      }

      const schematicMetadata = {
        factory: `./${schematicName}`,
        schema: `./${path.join(schematicName, 'schema.json')}`,
        description:
          getSchemaJson(schemaJsonPath).description ||
          `Schematic ${schematicName}`,
      };
      acc[schematicName] = schematicMetadata;

      return acc;
    }, {} as CollectionSchema['schematics']);

  return {
    name: collectionName.replace('.json', ''),
    version: '1.0',
    schematics,
  };
}

function getSchemaJson(schemaPath: string): SchematicSchema {
  return readJsonFile<SchematicSchema>(schemaPath);
}

function saveCollection(dir: string, collection: Record<string, any>) {
  fs.writeFileSync(path.join(dir, collectionName), JSON.stringify(collection));
}

function schematicsDir() {
  return path.join(rootDirectory, 'tools', 'schematics');
}

function toolsDir() {
  return path.join(rootDirectory, 'tools');
}

function toolsTsConfigPath() {
  return path.join(toolsDir(), 'tsconfig.tools.json');
}
function toolsTsConfig() {
  return readJsonFile<TsConfig>(toolsTsConfigPath());
}

function createWorkflow(dryRun: boolean) {
  const root = normalize(rootDirectory);
  const host = new virtualFs.ScopedHost(new NodeJsSyncHost(), root);
  return new NodeWorkflow(host, {
    packageManager: detectPackageManager(),
    root,
    dryRun,
    registry: new schema.CoreSchemaRegistry(formats.standardFormats),
    resolvePaths: [process.cwd(), rootDirectory],
  });
}

function listSchematics(
  collection: ReturnType<typeof getCollection>,
  logger: logging.Logger
) {
  try {
    const bodyLines: string[] = [];

    bodyLines.push(terminal.bold(terminal.green('WORKSPACE SCHEMATICS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.entries(collection.description.schematics).map(
        ([schematicName, schematicMeta]) => {
          return `${terminal.bold(schematicName)} : ${
            schematicMeta.description
          }`;
        }
      )
    );
    bodyLines.push('');

    output.log({
      title: '',
      bodyLines,
    });
  } catch (error) {
    logger.fatal(error.message);
    return 1;
  }

  return 0;
}

function getCollection(workflow: NodeWorkflow, name: string) {
  const collection = workflow.engine.createCollection(name);
  if (!collection) {
    throw new Error(`Cannot find collection '${name}'`);
  }

  return collection;
}

function createPromptProvider(): schema.PromptProvider {
  return (definitions: Array<schema.PromptDefinition>) => {
    const questions: inquirer.Questions = definitions.map((definition) => {
      const question: inquirer.Question = {
        name: definition.id,
        message: definition.message,
        default: definition.default,
      };

      const validator = definition.validator;
      if (validator) {
        question.validate = (input) => validator(input);
      }

      switch (definition.type) {
        case 'confirmation':
          return { ...question, type: 'confirm' };
        case 'list':
          return {
            ...question,
            type: !!definition.multiselect ? 'checkbox' : 'list',
            choices:
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
              }),
          };
        default:
          return { ...question, type: definition.type };
      }
    });

    return inquirer.prompt(questions);
  };
}

async function executeSchematic(
  schematicName: string,
  options: { [p: string]: any },
  workflow: NodeWorkflow,
  outDir: string,
  logger: logging.Logger
) {
  output.logSingleLine(
    `${output.colors.gray(`Executing your local schematic`)}: ${schematicName}`
  );

  let nothingDone = true;
  let loggingQueue: string[] = [];
  let hasError = false;

  workflow.reporter.subscribe((event: any) => {
    nothingDone = false;
    const eventPath = event.path.startsWith('/')
      ? event.path.substr(1)
      : event.path;
    switch (event.kind) {
      case 'error':
        hasError = true;

        const desc =
          event.description == 'alreadyExist'
            ? 'already exists'
            : 'does not exist.';
        logger.warn(`ERROR! ${eventPath} ${desc}.`);
        break;
      case 'update':
        loggingQueue.push(
          tags.oneLine`${terminal.white('UPDATE')} ${eventPath} (${
            event.content.length
          } bytes)`
        );
        break;
      case 'create':
        loggingQueue.push(
          tags.oneLine`${terminal.green('CREATE')} ${eventPath} (${
            event.content.length
          } bytes)`
        );
        break;
      case 'delete':
        loggingQueue.push(
          tags.oneLine`${terminal.yellow('DELETE')} ${eventPath}`
        );
        break;
      case 'rename':
        const eventToPath = event.to.startsWith('/')
          ? event.to.substr(1)
          : event.to;
        loggingQueue.push(
          tags.oneLine`${terminal.blue(
            'RENAME'
          )} ${eventPath} => ${eventToPath}`
        );
        break;
    }
  });

  workflow.lifeCycle.subscribe((event) => {
    if (event.kind === 'workflow-end' || event.kind === 'post-tasks-start') {
      if (!hasError) {
        loggingQueue.forEach((log) => logger.info(log));
      }

      loggingQueue = [];
      hasError = false;
    }
  });

  const args = options._.slice(1);
  workflow.registry.addSmartDefaultProvider('argv', (schema: JsonObject) => {
    if ('index' in schema) {
      return args[+schema.index];
    } else {
      return args;
    }
  });
  delete options._;

  if (options.defaults) {
    workflow.registry.addPreTransform(schema.transforms.addUndefinedDefaults);
  } else {
    workflow.registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  }

  workflow.engineHost.registerOptionsTransform(
    validateOptionsWithSchema(workflow.registry)
  );

  // Add support for interactive prompts
  if (options.interactive) {
    workflow.registry.usePromptProvider(createPromptProvider());
  }

  try {
    await workflow
      .execute({
        collection: path.join(outDir, collectionName),
        schematic: schematicName,
        options: options,
        logger: logger,
      })
      .toPromise();

    if (nothingDone) {
      logger.info('Nothing to be done.');
    }

    if (options.dryRun) {
      logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }
  } catch (err) {
    if (err instanceof UnsuccessfulWorkflowExecution) {
      // "See above" because we already printed the error.
      logger.fatal('The Schematic workflow failed. See above.');
    } else {
      logger.fatal(err.stack || err.message);
    }
    throw err;
  }
}

function parseSchematicOptions(
  schematicArgs: string[],
  schematicBooleanArgs: string[]
) {
  return yargsParser(schematicArgs, {
    boolean: ['dryRun', 'interactive', 'verbose', ...schematicBooleanArgs],
    alias: {
      dryRun: ['d'],
    },
    default: {
      interactive: true,
    },
  }) as ParsedSchematicArgs;
}

function getSchematicBooleanProps(
  schematicName: string | undefined,
  outDir: string
) {
  if (!schematicName) {
    return [];
  }

  const schemaJson = getSchemaJson(
    path.join(outDir, schematicName, 'schema.json')
  );
  const { properties = {} } = schemaJson;

  const booleanProps = Object.keys(properties).filter(
    (key) => properties[key].type === 'boolean'
  );

  return booleanProps;
}

function exists(file: string): boolean {
  try {
    return !!fs.statSync(file);
  } catch (e) {
    return false;
  }
}

function createTmpTsConfig(
  tsconfigPath: string,
  updateConfig: Partial<TsConfig>
) {
  const tmpTsConfigPath = path.join(
    path.dirname(tsconfigPath),
    'tsconfig.generated.json'
  );
  const originalTSConfig = readJsonFile<TsConfig>(tsconfigPath);
  const generatedTSConfig: TsConfig = {
    ...originalTSConfig,
    ...updateConfig,
  };

  process.on('exit', () => {
    cleanupTmpTsConfigFile(tmpTsConfigPath);
  });
  process.on('SIGTERM', () => {
    cleanupTmpTsConfigFile(tmpTsConfigPath);
    process.exit(0);
  });
  process.on('SIGINT', () => {
    cleanupTmpTsConfigFile(tmpTsConfigPath);
    process.exit(0);
  });

  writeJsonFile(tmpTsConfigPath, generatedTSConfig);

  return tmpTsConfigPath;
}

function cleanupTmpTsConfigFile(tmpTsConfigPath) {
  try {
    if (tmpTsConfigPath) {
      fs.unlinkSync(tmpTsConfigPath);
    }
  } catch (e) {}
}

function formatOption(name: string, description: string) {
  return `  --${(name + '                     ').substr(0, 22)}${terminal.grey(
    description
  )}`;
}

function printHelp(schema: SchematicSchema, logger: logging.Logger) {
  const args = Object.keys(schema.properties)
    .map((name) => {
      const d = schema.properties[name];
      const def = d.default ? ` (default: ${d.default})` : '';
      return formatOption(name, `${d.description}${def}`);
    })
    .join('\n');

  logger.info(tags.stripIndent`

${terminal.bold('Options')}:
${args}
${formatOption('help', 'Show available options for schematic.')}
  `);
}

function printGenHelp(schema: SchematicSchema, logger: logging.Logger) {
  try {
    printHelp(
      {
        ...schema,
        properties: {
          ...schema.properties,
          dryRun: {
            type: 'boolean',
            default: false,
            description: `Runs through and reports activity without writing to disk.`,
          },
        },
      },
      logger
    );
  } catch (error) {
    logger.fatal(error.message);
    return 1;
  }

  return 0;
}
