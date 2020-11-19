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
  SchematicEngine,
  UnsuccessfulWorkflowExecution,
} from '@angular-devkit/schematics';
import {
  NodeModulesEngineHost,
  NodeWorkflow,
  validateOptionsWithSchema,
} from '@angular-devkit/schematics/tools';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { readFileSync, writeFileSync } from 'fs';
import { copySync, removeSync } from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { appRootPath } from '../utils/app-root';
import {
  detectPackageManager,
  getPackageManagerExecuteCommand,
} from '../utils/detect-package-manager';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fileutils';
import { output } from '../utils/output';
import { CompilerOptions } from 'typescript';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';

const rootDirectory = appRootPath;

type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};

export async function workspaceGenerators(args: string[]) {
  const outDir = compileTools();
  const parsedArgs = parseOptions(args, outDir);
  const logger = createConsoleLogger(
    parsedArgs.verbose,
    process.stdout,
    process.stderr
  );
  const collectionFile = path.join(outDir, 'workspace-generators.json');
  if (parsedArgs.listGenerators) {
    return listGenerators(collectionFile, logger);
  }
  const generatorName = args[0];
  const ws = new Workspaces();
  if (ws.isNxGenerator(collectionFile, generatorName)) {
    try {
      execSync(
        `npx tao g "${collectionFile}":${generatorName} ${args
          .slice(1)
          .join(' ')}`,
        { stdio: ['inherit', 'inherit', 'inherit'] }
      );
    } catch (e) {
      process.exit(1);
    }
  } else {
    try {
      const workflow = createWorkflow(parsedArgs.dryRun);
      await executeAngularDevkitSchematic(
        generatorName,
        parsedArgs,
        workflow,
        outDir,
        logger
      );
    } catch (e) {
      process.exit(1);
    }
  }
}

// compile tools
function compileTools() {
  const toolsOutDir = getToolsOutDir();
  removeSync(toolsOutDir);
  compileToolsDir(toolsOutDir);

  const generatorsOutDir = path.join(toolsOutDir, 'generators');
  const collectionData = constructCollection();
  saveCollection(generatorsOutDir, collectionData);
  return generatorsOutDir;
}

function getToolsOutDir() {
  return path.resolve(toolsDir(), toolsTsConfig().compilerOptions.outDir);
}

function compileToolsDir(outDir: string) {
  copySync(generatorsDir(), path.join(outDir, 'generators'));

  const tmpTsConfigPath = createTmpTsConfig(toolsTsConfigPath(), {
    include: [path.join(generatorsDir(), '**/*.ts')],
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
  const generators = {};
  fs.readdirSync(generatorsDir()).forEach((c) => {
    const childDir = path.join(generatorsDir(), c);
    if (exists(path.join(childDir, 'schema.json'))) {
      generators[c] = {
        factory: `./${c}`,
        schema: `./${path.join(c, 'schema.json')}`,
        description: `Schematic ${c}`,
      };
    }
  });
  return {
    name: 'workspace-generators',
    version: '1.0',
    schematics: generators, // TODO vsavkin: remove this
  };
}

function saveCollection(dir: string, collection: any) {
  writeFileSync(
    path.join(dir, 'workspace-generators.json'),
    JSON.stringify(collection)
  );
}

function generatorsDir() {
  return path.join(rootDirectory, 'tools', 'generators');
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

function listGenerators(collectionName: string, logger: logging.Logger) {
  try {
    const engineHost = new NodeModulesEngineHost();
    const engine = new SchematicEngine(engineHost);
    const collection = engine.createCollection(collectionName);
    logger.info(engine.listSchematicNames(collection).join('\n'));
  } catch (error) {
    logger.fatal(error.message);
    return 1;
  }

  return 0;
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

// execute schematic
async function executeAngularDevkitSchematic(
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
        collection: path.join(outDir, 'workspace-schematics.json'),
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

function parseOptions(args: string[], outDir: string): { [k: string]: any } {
  const schemaPath = path.join(outDir, args[0], 'schema.json');
  let booleanProps = [];
  if (fileExists(schemaPath)) {
    const { properties } = readJsonFile(
      path.join(outDir, args[0], 'schema.json')
    );
    if (properties) {
      booleanProps = Object.keys(properties).filter(
        (key) => properties[key].type === 'boolean'
      );
    }
  }
  return yargsParser(args, {
    boolean: ['dryRun', 'listGenerators', 'interactive', ...booleanProps],
    alias: {
      dryRun: ['d'],
      listSchematics: ['l'],
    },
    default: {
      interactive: true,
    },
  });
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
