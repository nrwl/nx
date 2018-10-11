import { execSync } from 'child_process';
import * as fs from 'fs';
import { readFileSync, writeFileSync, statSync } from 'fs';
import * as path from 'path';
import { copySync, removeSync } from 'fs-extra';
import { NodeWorkflow } from '@angular-devkit/schematics/tools';
import { UnsuccessfulWorkflowExecution } from '@angular-devkit/schematics';

import * as yargsParser from 'yargs-parser';
import * as appRoot from 'app-root-path';
import { virtualFs, normalize, JsonObject } from '@angular-devkit/core';
import { NodeJsSyncHost, createConsoleLogger } from '@angular-devkit/core/node';

const rootDirectory = appRoot.path;

export function workspaceSchematic(args: string[]) {
  const outDir = compileTools();
  const schematicName = args[0];
  const workflow = createWorkflow();
  executeSchematic(schematicName, parseOptions(args), workflow, outDir);
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
  try {
    execSync('tsc -p tools/tsconfig.tools.json', {
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

function createWorkflow() {
  const root = normalize(rootDirectory);
  const host = new virtualFs.ScopedHost(new NodeJsSyncHost(), root);
  return new NodeWorkflow(host, {
    packageManager: fileExists('yarn.lock') ? 'yarn' : 'npm',
    root
  });
}

// execute schematic
async function executeSchematic(
  schematicName: string,
  options: { [p: string]: any },
  workflow: NodeWorkflow,
  outDir: string
) {
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
  const logger = createConsoleLogger(true, process.stdout, process.stderr);

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
  return yargsParser(args);
}

function exists(file: string): boolean {
  try {
    return !!fs.statSync(file);
  } catch (e) {
    return false;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}
