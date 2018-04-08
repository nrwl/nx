import { execSync } from 'child_process';
import * as fs from 'fs';
import { readFileSync, statSync, writeFileSync } from 'fs';
import * as path from 'path';
import { copySync } from 'fs-extra';
import {
  FileSystemEngineHost,
  FileSystemHost,
  NodeModulesEngineHost,
  validateOptionsWithSchema
} from '@angular-devkit/schematics/tools';
import { BuiltinTaskExecutor } from '@angular-devkit/schematics/tasks/node';
import {
  CollectionDescription,
  EngineHost,
  FileSystemSink,
  FileSystemTree,
  RuleFactory,
  Schematic,
  SchematicDescription,
  SchematicEngine,
  Tree,
  DryRunSink
} from '@angular-devkit/schematics';
import { of } from 'rxjs/observable/of';
import { concat, concatMap, ignoreElements, map } from 'rxjs/operators';
import { Observable } from 'rxjs/Observable';
import { Url } from 'url';

import * as yargsParser from 'yargs-parser';
import { CoreSchemaRegistry } from '@angular-devkit/core/src/json/schema';
import { standardFormats } from '@angular-devkit/schematics/src/formats';
import { getAppRootPath } from '../utils/app-root-path';

const rootDirectory = getAppRootPath();

export function workspaceSchematic(args: string[]) {
  const outDir = compileTools();
  const schematicName = args[0];
  const { schematic, host, engine } = prepareExecutionContext(
    outDir,
    schematicName
  );
  executeSchematic(schematicName, parseOptions(args), schematic, host, engine);
}

// compile tools
function compileTools() {
  const toolsOutDir = getToolsOutDir();
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

// prepareExecutionContext
function prepareExecutionContext(outDir: string, schematicName: string) {
  const engineHost = new EngineHostHandlingWorkspaceSchematics(outDir);
  const engine = new SchematicEngine(engineHost);

  const schematic = engine
    .createCollection('workspace-schematics')
    .createSchematic(schematicName);
  const host = of(new FileSystemTree(new FileSystemHost(rootDirectory)));
  return { schematic, host, engine };
}

// execute schematic
function executeSchematic(
  schematicName: string,
  options: { [p: string]: any },
  schematic: Schematic<any, any>,
  host: Observable<FileSystemTree>,
  engine: SchematicEngine<any, object>
) {
  const dryRunSink = new DryRunSink(rootDirectory, true);
  let error = false;
  dryRunSink.reporter.subscribe((event: any) => {
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
        error = true;
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

  const fsSink = new FileSystemSink(rootDirectory, true);

  schematic
    .call(options, host)
    .pipe(
      map((tree: Tree) => Tree.optimize(tree)),
      concatMap((tree: Tree) =>
        dryRunSink.commit(tree).pipe(ignoreElements(), concat(of(tree)))
      ),
      concatMap(
        (tree: Tree) =>
          error
            ? of(tree)
            : fsSink.commit(tree).pipe(ignoreElements(), concat(of(tree)))
      ),
      concatMap(() => (error ? [] : engine.executePostTasks()))
    )
    .subscribe(
      () => {},
      e => {
        console.error(`Error occurred while executing '${schematicName}':`);
        console.error(e);
      },
      () => {
        console.log(`'${schematicName}' completed.`);
      }
    );
}

/**
 * It uses FileSystemEngineHost for collection named "workspace-tools" and NodeModulesEngineHost
 * for everything else.
 */
class EngineHostHandlingWorkspaceSchematics implements EngineHost<any, any> {
  readonly toolsHost: FileSystemEngineHost;
  readonly defaultHost: NodeModulesEngineHost;

  constructor(outDir: string) {
    const transforms = validateOptionsWithSchema(
      new CoreSchemaRegistry(standardFormats)
    );
    this.toolsHost = new FileSystemEngineHost(outDir);
    this.toolsHost.registerOptionsTransform(transforms);

    this.defaultHost = new NodeModulesEngineHost();
    this.defaultHost.registerOptionsTransform(transforms);
    this.defaultHost.registerTaskExecutor(BuiltinTaskExecutor.NodePackage, {
      rootDirectory,
      packageManager: fileExists('yarn.lock') ? 'yarn' : 'npm'
    });
  }

  createCollectionDescription(name: string): CollectionDescription<any> {
    return this.hostFor(name).createCollectionDescription(name);
  }

  createSchematicDescription(
    name: string,
    collection: CollectionDescription<any>
  ): SchematicDescription<any, any> | null {
    return this.hostFor(collection.name).createSchematicDescription(
      name,
      collection
    );
  }

  getSchematicRuleFactory<OptionT extends object>(
    schematic: SchematicDescription<any, any>,
    collection: CollectionDescription<any>
  ): RuleFactory<OptionT> {
    return this.hostFor(collection.name).getSchematicRuleFactory(
      schematic,
      collection
    );
  }

  createSourceFromUrl(url: Url, context: any): any {
    return this.hostFor(context.schematic.collection.name).createSourceFromUrl(
      url
    );
  }

  transformOptions<OptionT extends object, ResultT extends object>(
    schematic: SchematicDescription<any, any>,
    options: OptionT
  ): Observable<ResultT> {
    return this.hostFor(schematic.collection.name).transformOptions(
      schematic,
      options
    );
  }

  listSchematics(collection: any): string[] {
    return this.listSchematicNames(collection.description);
  }

  listSchematicNames(collection: CollectionDescription<any>): string[] {
    return this.hostFor(collection.name).listSchematicNames(collection);
  }

  createTaskExecutor(name: string): Observable<any> {
    return this.defaultHost.createTaskExecutor(name);
  }

  hasTaskExecutor(name: string): boolean {
    return this.defaultHost.hasTaskExecutor(name);
  }

  private hostFor(name: string) {
    return name === 'workspace-schematics' ? this.toolsHost : this.defaultHost;
  }
}

function parseOptions(args: string[]): { [k: string]: any } {
  const parsed = yargsParser(args);
  if (parsed._ && parsed._.length > 1) {
    parsed.name = parsed._[1];
  }
  delete parsed._;
  return parsed;
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
