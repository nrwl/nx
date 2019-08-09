import {
  JsonObject,
  logging,
  normalize,
  schema,
  virtualFs
} from '@angular-devkit/core';
import { createConsoleLogger, NodeJsSyncHost } from '@angular-devkit/core/node';
import {
  SchematicEngine,
  UnsuccessfulWorkflowExecution
} from '@angular-devkit/schematics';
import {
  NodeModulesEngineHost,
  NodeWorkflow
} from '@angular-devkit/schematics/tools';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { readFileSync, writeFileSync } from 'fs';
import { copySync, removeSync } from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { fileExists } from '../utils/fileutils';
import { appRootPath } from '../utils/app-root';
import { output } from './output';
import { platform } from 'os';

const rootDirectory = appRootPath;

export function workspaceSchematic(args: string[]) {
  const parsedArgs = parseOptions(args);
  const logger = createConsoleLogger(
    parsedArgs.verbose,
    process.stdout,
    process.stderr
  );
  const outDir = compileTools();
  if (parsedArgs.listSchematics) {
    return listSchematics(
      path.join(outDir, 'workspace-schematics.json'),
      logger
    );
  }
  const schematicName = args[0];
  const workflow = createWorkflow(parsedArgs.dryRun);
  executeSchematic(schematicName, parsedArgs, workflow, outDir, logger);
}

// compile tools
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
  return path.resolve(
    rootDirectory,
    'tools',
    JSON.parse(
      readFileSync(
        path.join(rootDirectory, 'tools', 'tsconfig.tools.json'),
        'UTF-8'
      )
    ).compilerOptions.outDir
  );
}

function compileToolsDir(outDir: string) {
  copySync(path.join(rootDirectory, 'tools'), outDir);
  const tsc =
    platform() === 'win32'
      ? `.\\node_modules\\.bin\\tsc`
      : `./node_modules/.bin/tsc`;
  try {
    execSync(`${tsc} -p tools/tsconfig.tools.json`, {
      stdio: 'inherit',
      cwd: rootDirectory
    });
  } catch (e) {
    process.exit(1);
  }
}

function constructCollection() {
  const schematics = {};
  fs.readdirSync(schematicsDir()).forEach(c => {
    const childDir = path.join(schematicsDir(), c);
    if (exists(path.join(childDir, 'schema.json'))) {
      schematics[c] = {
        factory: `./${c}`,
        schema: `./${path.join(c, 'schema.json')}`,
        description: `Schematic ${c}`
      };
    }
  });
  return {
    name: 'workspace-schematics',
    version: '1.0',
    schematics
  };
}

function saveCollection(dir: string, collection: any) {
  writeFileSync(
    path.join(dir, 'workspace-schematics.json'),
    JSON.stringify(collection)
  );
}

function schematicsDir() {
  return path.join('tools', 'schematics');
}

function createWorkflow(dryRun: boolean) {
  const root = normalize(rootDirectory);
  const host = new virtualFs.ScopedHost(new NodeJsSyncHost(), root);
  return new NodeWorkflow(host, {
    packageManager: detectPackageManager(),
    root,
    dryRun
  });
}

function detectPackageManager(): string {
  try {
    const output = execSync(`nx config cli.packageManager`, {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim()
      .split('\n');
    return output[output.length - 1].trim();
  } catch (e) {
    return fileExists('yarn.lock')
      ? 'yarn'
      : fileExists('pnpm-lock.yaml')
      ? 'pnpm'
      : 'npm';
  }
}

function listSchematics(collectionName: string, logger: logging.Logger) {
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
    const questions: inquirer.Questions = definitions.map(definition => {
      const question: inquirer.Question = {
        name: definition.id,
        message: definition.message,
        default: definition.default
      };

      const validator = definition.validator;
      if (validator) {
        question.validate = input => validator(input);
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
              definition.items.map(item => {
                if (typeof item == 'string') {
                  return item;
                } else {
                  return {
                    name: item.label,
                    value: item.value
                  };
                }
              })
          };
        default:
          return { ...question, type: definition.type };
      }
    });

    return inquirer.prompt(questions);
  };
}

// execute schematic
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
  workflow.reporter.subscribe((event: any) => {
    nothingDone = false;
    const eventPath = event.path.startsWith('/')
      ? event.path.substr(1)
      : event.path;
    switch (event.kind) {
      case 'error':
        const desc =
          event.description == 'alreadyExist'
            ? 'already exists'
            : 'does not exist.';
        console.error(`error! ${eventPath} ${desc}.`);
        break;
      case 'update':
        console.log(`update ${eventPath} (${event.content.length} bytes)`);
        break;
      case 'create':
        console.log(`create ${eventPath} (${event.content.length} bytes)`);
        break;
      case 'delete':
        console.log(`delete ${eventPath}`);
        break;
      case 'rename':
        const eventToPath = event.to.startsWith('/')
          ? event.to.substr(1)
          : event.to;
        console.log(`rename ${eventPath} => ${eventToPath}`);
        break;
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
        logger: logger
      })
      .toPromise();

    if (nothingDone) {
      logger.info('Nothing to be done.');
    }
  } catch (err) {
    if (err instanceof UnsuccessfulWorkflowExecution) {
      // "See above" because we already printed the error.
      logger.fatal('The Schematic workflow failed. See above.');
    } else {
      logger.fatal(err.stack || err.message);
    }
  }
}

function parseOptions(args: string[]): { [k: string]: any } {
  return yargsParser(args, {
    boolean: ['dryRun', 'listSchematics', 'interactive'],
    alias: {
      dryRun: ['d'],
      listSchematics: ['l']
    },
    default: {
      interactive: true
    }
  });
}

function exists(file: string): boolean {
  try {
    return !!fs.statSync(file);
  } catch (e) {
    return false;
  }
}
