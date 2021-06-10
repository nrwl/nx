/* eslint-disable no-restricted-imports */
import {
  fragment,
  logging,
  normalize,
  Path,
  PathFragment,
  schema,
  tags,
  virtualFs,
  workspaces,
} from '@angular-devkit/core';
import * as chalk from 'chalk';
import { createConsoleLogger, NodeJsSyncHost } from '@angular-devkit/core/node';
import { Stats } from 'fs';
import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';
import { GenerateOptions } from './generate';
import { Tree } from '../shared/tree';
import {
  inlineProjectConfigurations,
  toNewFormat,
  toNewFormatOrNull,
  toOldFormatOrNull,
  workspaceConfigName,
} from '@nrwl/tao/src/shared/workspace';
import { dirname, extname, resolve, join } from 'path';
import { FileBuffer } from '@angular-devkit/core/src/virtual-fs/host/interface';
import { EMPTY, Observable, of, concat } from 'rxjs';
import { catchError, map, switchMap, tap, toArray } from 'rxjs/operators';
import { NX_ERROR, NX_PREFIX } from '../shared/logger';
import { readJsonFile } from '../utils/fileutils';
import { parseJson, serializeJson } from '../utils/json';

export async function scheduleTarget(
  root: string,
  opts: {
    project: string;
    target: string;
    configuration: string;
    runOptions: any;
    executor: string;
  },
  verbose: boolean
): Promise<Observable<import('@angular-devkit/architect').BuilderOutput>> {
  const { Architect } = require('@angular-devkit/architect');
  const {
    WorkspaceNodeModulesArchitectHost,
  } = require('@angular-devkit/architect/node');

  const logger = getTargetLogger(opts.executor, verbose);
  const fsHost = new NxScopedHost(normalize(root));
  const { workspace } = await workspaces.readWorkspace(
    workspaceConfigName(root),
    workspaces.createWorkspaceHost(fsHost)
  );

  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const architectHost = new WorkspaceNodeModulesArchitectHost(workspace, root);
  const architect = new Architect(architectHost, registry);
  const run = await architect.scheduleTarget(
    {
      project: opts.project,
      target: opts.target,
      configuration: opts.configuration,
    },
    opts.runOptions,
    { logger }
  );

  return run.output;
}

function createWorkflow(
  fsHost: virtualFs.Host<Stats>,
  root: string,
  opts: any
) {
  const NodeWorkflow = require('@angular-devkit/schematics/tools').NodeWorkflow;
  const workflow = new NodeWorkflow(fsHost, {
    force: opts.force,
    dryRun: opts.dryRun,
    packageManager: detectPackageManager(),
    root: normalize(root),
    registry: new schema.CoreSchemaRegistry(
      require('@angular-devkit/schematics').formats.standardFormats
    ),
    resolvePaths: [process.cwd(), root],
  });
  workflow.registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  workflow.engineHost.registerOptionsTransform(
    require('@angular-devkit/schematics/tools').validateOptionsWithSchema(
      workflow.registry
    )
  );
  return workflow;
}

function getCollection(workflow: any, name: string) {
  const collection = workflow.engine.createCollection(name);
  if (!collection) throw new Error(`Cannot find collection '${name}'`);
  return collection;
}

async function createRecorder(
  host: NxScopedHost,
  record: {
    loggingQueue: string[];
    error: boolean;
  },
  logger: logging.Logger
) {
  const actualConfigName = await host.workspaceConfigName();
  return (event: import('@angular-devkit/schematics').DryRunEvent) => {
    let eventPath = event.path.startsWith('/')
      ? event.path.substr(1)
      : event.path;

    if (eventPath === 'workspace.json' || eventPath === 'angular.json') {
      eventPath = actualConfigName;
    }

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
        tags.oneLine`${chalk.white('UPDATE')} ${eventPath}`
      );
    } else if (event.kind === 'create') {
      record.loggingQueue.push(
        tags.oneLine`${chalk.green('CREATE')} ${eventPath}`
      );
    } else if (event.kind === 'delete') {
      record.loggingQueue.push(`${chalk.yellow('DELETE')} ${eventPath}`);
    } else if (event.kind === 'rename') {
      record.loggingQueue.push(
        `${chalk.blue('RENAME')} ${eventPath} => ${event.to}`
      );
    }
  };
}

async function runSchematic(
  host: NxScopedHost,
  root: string,
  workflow: import('@angular-devkit/schematics/tools').NodeWorkflow,
  logger: logging.Logger,
  opts: GenerateOptions,
  schematic: import('@angular-devkit/schematics').Schematic<
    import('@angular-devkit/schematics/tools').FileSystemCollectionDescription,
    import('@angular-devkit/schematics/tools').FileSystemSchematicDescription
  >,
  printDryRunMessage = true,
  recorder: any = null
): Promise<{ status: number; loggingQueue: string[] }> {
  const record = { loggingQueue: [] as string[], error: false };
  workflow.reporter.subscribe(
    recorder || (await createRecorder(host, record, logger))
  );

  try {
    await workflow
      .execute({
        collection: opts.collectionName,
        schematic: opts.generatorName,
        options: opts.generatorOptions,
        debug: opts.debug,
        logger,
      })
      .toPromise();
  } catch (e) {
    console.log(e);
    throw e;
  }
  if (!record.error) {
    record.loggingQueue.forEach((log) => logger.info(log));
  }
  if (opts.dryRun && printDryRunMessage) {
    logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
  }
  return { status: 0, loggingQueue: record.loggingQueue };
}

export class NxScopedHost extends virtualFs.ScopedHost<any> {
  constructor(root: Path) {
    super(new NodeJsSyncHost(), root);
  }

  read(path: Path): Observable<FileBuffer> {
    return this.context(path).pipe(
      switchMap((r) => {
        if (r.isWorkspaceConfig) {
          if (r.isNewFormat) {
            return super.read(r.actualConfigFileName).pipe(
              switchMap((r) => {
                try {
                  const w = parseJson(Buffer.from(r).toString());
                  console.log('REMOVE ME: SCOPED READ - BEFORE INLINING', w);
                  return this.resolveInlineProjectConfigurations(w).pipe(
                    map((w) => {
                      const formatted = toOldFormatOrNull(w);
                      return formatted
                        ? Buffer.from(serializeJson(formatted))
                        : Buffer.from(serializeJson(w));
                    })
                  );
                } catch (ex) {
                  return of(r);
                }
              })
            );
          } else {
            return super.read(r.actualConfigFileName).pipe(
              map((r) => {
                const w = parseJson(Buffer.from(r).toString());
                return Buffer.from(
                  serializeJson(inlineProjectConfigurations(w))
                );
              })
            );
          }
        } else {
          return super.read(path);
        }
      })
    );
  }

  write(path: Path, content: FileBuffer): Observable<void> {
    return this.context(path).pipe(
      switchMap((r) => {
        if (r.isWorkspaceConfig) {
          return this.writeWorkspaceConfiguration(r, content);
        } else {
          return super.write(path, content);
        }
      })
    );
  }

  isFile(path: Path): Observable<boolean> {
    return this.context(path).pipe(
      switchMap((r) => {
        if (r.isWorkspaceConfig) {
          return super.isFile(r.actualConfigFileName);
        } else {
          return super.isFile(path);
        }
      })
    );
  }

  exists(path: Path): Observable<boolean> {
    return this.context(path).pipe(
      switchMap((r) => {
        if (r.isWorkspaceConfig) {
          return super.exists(r.actualConfigFileName);
        } else {
          return super.exists(path);
        }
      })
    );
  }

  workspaceConfigName(): Promise<string> {
    return super
      .exists('/angular.json' as any)
      .pipe(
        map((hasAngularJson) =>
          hasAngularJson ? 'angular.json' : 'workspace.json'
        )
      )
      .toPromise();
  }

  protected context(path: string): Observable<{
    isWorkspaceConfig: boolean;
    actualConfigFileName: any;
    isNewFormat: boolean;
  }> {
    if (isWorkspaceConfigPath(path)) {
      return super.exists('/angular.json' as any).pipe(
        switchMap((isAngularJson) => {
          const actualConfigFileName = isAngularJson
            ? '/angular.json'
            : '/workspace.json';
          return super.read(actualConfigFileName as any).pipe(
            map((r) => {
              try {
                const w = parseJson(Buffer.from(r).toString());
                return {
                  isWorkspaceConfig: true,
                  actualConfigFileName,
                  isNewFormat: w.version === 2,
                };
              } catch {
                return {
                  isWorkspaceConfig: true,
                  actualConfigFileName,
                  isNewFormat: false,
                };
              }
            })
          );
        })
      );
    } else {
      return of({
        isWorkspaceConfig: false,
        actualConfigFileName: null,
        isNewFormat: false,
      });
    }
  }

  private writeWorkspaceConfiguration(context, content): Observable<void> {
    const config = parseJson(Buffer.from(content).toString());
    if (context.isNewFormat) {
      try {
        const w = parseJson(Buffer.from(content).toString());
        const formatted = toNewFormatOrNull(w);
        if (formatted) {
          return this.writeWorkspaceConfigFiles(
            context.actualConfigFileName,
            formatted
          );
        } else {
          return this.writeWorkspaceConfigFiles(
            context.actualConfigFileName,
            config
          );
        }
      } catch (e) {
        return this.writeWorkspaceConfigFiles(
          context.actualConfigFileName,
          config
        );
      }
    } else {
      return this.writeWorkspaceConfigFiles(
        context.actualConfigFileName,
        config
      );
    }
  }

  private writeWorkspaceConfigFiles(workspaceFileName, config) {
    Object.entries(config.projects as Record<string, any>).forEach(
      ([project, config]) => {
        if (config.configFilePath) {
          const configPath = config.configFilePath;
          const fileConfigObject = { ...config };
          delete fileConfigObject.configFilePath;
          super.write(configPath, Buffer.from(serializeJson(fileConfigObject)));
          config.projects[project] = dirname(configPath);
        }
      }
    );
    return super.write(workspaceFileName, Buffer.from(serializeJson(config)));
  }

  protected resolveInlineProjectConfigurations(config: {
    projects: Record<string, any>;
  }): Observable<Object> {
    let observable: Observable<any> = EMPTY;
    Object.entries((config.projects as Record<string, any>) ?? {}).forEach(
      ([project, projectConfig]) => {
        if (typeof projectConfig === 'string') {
          const configFilePath = `${projectConfig}/project.json`;
          const next = super.read(configFilePath as Path).pipe(
            map((x) => ({
              project,
              projectConfig: {
                ...parseJson(Buffer.from(x).toString()),
                configFilePath,
              },
            }))
          );
          observable = observable ? concat(observable, next) : next;
        }
      }
    );
    return observable.pipe(
      toArray(),
      map((x: any[]) => {
        x.forEach(({ project, projectConfig }) => {
          config.projects[project] = projectConfig;
        });
        return config;
      })
    );
  }
}

/**
 * This host contains the workaround needed to run Angular migrations
 */
export class NxScopedHostForMigrations extends NxScopedHost {
  constructor(root: Path) {
    super(root);
  }

  read(path: Path): Observable<FileBuffer> {
    if (isWorkspaceConfigPath(path)) {
      return super.read(path).pipe(map(processConfigWhenReading));
    } else {
      return super.read(path);
    }
  }

  write(path: Path, content: FileBuffer) {
    if (isWorkspaceConfigPath(path)) {
      return super.write(path, processConfigWhenWriting(content));
    } else {
      return super.write(path, content);
    }
  }
}

export class NxScopeHostUsedForWrappedSchematics extends NxScopedHost {
  constructor(root: Path, private readonly host: Tree) {
    super(root);
  }

  read(path: Path): Observable<FileBuffer> {
    if (isWorkspaceConfigPath(path)) {
      const match = findWorkspaceConfigFileChange(this.host);
      // no match, default to existing behavior
      if (!match) {
        return super.read(path);
      }

      // we try to format it, if it changes, return it, otherwise return the original change
      try {
        const w = parseJson(Buffer.from(match.content).toString());
        return this.resolveInlineProjectConfigurations(w).pipe(
          map((x) => {
            const formatted = toOldFormatOrNull(w);
            return formatted
              ? Buffer.from(serializeJson(formatted))
              : Buffer.from(serializeJson(x));
          })
        );
      } catch (e) {
        return super.read(path);
      }
    } else {
      // found a matching change in the host
      const match = findMatchingFileChange(this.host, path);
      return match ? of(Buffer.from(match.content)) : super.read(path);
    }
  }

  exists(path: Path): Observable<boolean> {
    if (isWorkspaceConfigPath(path)) {
      return findWorkspaceConfigFileChange(this.host)
        ? of(true)
        : super.exists(path);
    } else {
      return findMatchingFileChange(this.host, path)
        ? of(true)
        : super.exists(path);
    }
  }

  isDirectory(path: Path): Observable<boolean> {
    return super.isDirectory(path).pipe(
      catchError(() => of(false)),
      switchMap((isDirectory) =>
        isDirectory
          ? of(true)
          : of(this.host.exists(path) && !this.host.isFile(path))
      )
    );
  }

  isFile(path: Path): Observable<boolean> {
    if (isWorkspaceConfigPath(path)) {
      return findWorkspaceConfigFileChange(this.host)
        ? of(true)
        : super.isFile(path);
    } else {
      return findMatchingFileChange(this.host, path)
        ? of(true)
        : super.isFile(path);
    }
  }

  list(path: Path): Observable<PathFragment[]> {
    const fragments = this.host.children(path).map((child) => fragment(child));
    return of(fragments);
  }
}

function findWorkspaceConfigFileChange(host: Tree) {
  return host
    .listChanges()
    .find((f) => f.path == 'workspace.json' || f.path == 'angular.json');
}

function findMatchingFileChange(host: Tree, path: Path) {
  const targetPath = path.startsWith('/') ? path.substring(1) : path.toString;
  return host
    .listChanges()
    .find((f) => f.path == targetPath.toString() && f.type !== 'DELETE');
}

function isWorkspaceConfigPath(p: Path | string) {
  return (
    p === 'angular.json' ||
    p === '/angular.json' ||
    p === 'workspace.json' ||
    p === '/workspace.json'
  );
}

function processConfigWhenReading(content: ArrayBuffer) {
  try {
    const json = parseJson(Buffer.from(content).toString());
    Object.values(json.projects).forEach((p: any) => {
      try {
        Object.values(p.architect || p.targets).forEach((e: any) => {
          if (
            (e.builder === '@nrwl/jest:jest' ||
              e.executor === '@nrwl/jest:jest') &&
            !e.options.tsConfig
          ) {
            e.options.tsConfig = `${p.root}/tsconfig.spec.json`;
          }
        });
      } catch (e) {}
    });
    return Buffer.from(serializeJson(json));
  } catch (e) {
    return content;
  }
}

function processConfigWhenWriting(content: ArrayBuffer) {
  try {
    const json = parseJson(Buffer.from(content).toString());
    Object.values(json.projects).forEach((p: any) => {
      try {
        Object.values(p.architect || p.targets).forEach((e: any) => {
          if (
            (e.builder === '@nrwl/jest:jest' ||
              e.executor === '@nrwl/jest:jest') &&
            e.options.tsConfig
          ) {
            delete e.options.tsConfig;
          }
        });
      } catch (e) {}
    });
    return Buffer.from(serializeJson(json));
  } catch (e) {
    return content;
  }
}

export async function generate(
  root: string,
  opts: GenerateOptions,
  verbose: boolean
) {
  const logger = getLogger(verbose);
  const fsHost = new NxScopedHost(normalize(root));
  const workflow = createWorkflow(fsHost, root, opts);
  const collection = getCollection(workflow, opts.collectionName);
  const schematic = collection.createSchematic(opts.generatorName, true);
  return (
    await runSchematic(
      fsHost,
      root,
      workflow,
      logger as any,
      { ...opts, generatorName: schematic.description.name },
      schematic
    )
  ).status;
}

export async function runMigration(
  root: string,
  collection: string,
  schematic: string,
  isVerbose: boolean
) {
  const NodeModulesEngineHost =
    require('@angular-devkit/schematics/tools').NodeModulesEngineHost;

  class MigrationEngineHost extends NodeModulesEngineHost {
    private nodeInstallLogPrinted = false;

    constructor(logger: logging.Logger) {
      super();

      // Overwrite the original CLI node package executor with a new one that does basically nothing
      // since nx migrate doesn't do npm installs by itself
      // (https://github.com/angular/angular-cli/blob/5df776780deadb6be5048b3ab006a5d3383650dc/packages/angular_devkit/schematics/tools/workflow/node-workflow.ts#L41)
      this.registerTaskExecutor({
        name: require('@angular-devkit/schematics/tasks/package-manager/options')
          .NodePackageName,
        create: () =>
          Promise.resolve<import('@angular-devkit/schematics').TaskExecutor>(
            () => {
              return new Promise((res) => {
                if (!this.nodeInstallLogPrinted) {
                  logger.warn(
                    `An installation of node_modules has been required. Make sure to run it after the migration`
                  );
                  this.nodeInstallLogPrinted = true;
                }

                res();
              });
            }
          ),
      });

      this.registerTaskExecutor(
        require('@angular-devkit/schematics/tasks/node').BuiltinTaskExecutor
          .RunSchematic
      );
    }

    protected _resolveCollectionPath(name: string): string {
      let collectionPath: string | undefined = undefined;

      if (name.startsWith('.') || name.startsWith('/')) {
        name = resolve(name);
      }

      if (extname(name)) {
        collectionPath = require.resolve(name);
      } else {
        let packageJsonPath;
        try {
          packageJsonPath = require.resolve(join(name, 'package.json'), {
            paths: [process.cwd()],
          });
        } catch (e) {
          // workaround for a bug in node 12
          packageJsonPath = require.resolve(
            join(process.cwd(), name, 'package.json')
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const packageJson = require(packageJsonPath);
        let pkgJsonSchematics =
          packageJson['nx-migrations'] ?? packageJson['ng-update'];
        if (!pkgJsonSchematics) {
          throw new Error(`Could not find migrations in package: "${name}"`);
        }
        if (typeof pkgJsonSchematics != 'string') {
          pkgJsonSchematics = pkgJsonSchematics.migrations;
        }
        collectionPath = require.resolve(pkgJsonSchematics, {
          paths: [dirname(packageJsonPath)],
        });
      }

      try {
        if (collectionPath) {
          readJsonFile(collectionPath);
          return collectionPath;
        }
      } catch {
        throw new Error(`Invalid migration file in package: "${name}"`);
      }
      throw new Error(`Collection cannot be resolved: "${name}"`);
    }
  }

  const { BaseWorkflow } = require('@angular-devkit/schematics/src/workflow');

  class MigrationsWorkflow extends BaseWorkflow {
    constructor(host: virtualFs.Host, logger: logging.Logger) {
      super({
        host,
        engineHost: new MigrationEngineHost(logger) as any,
        force: true,
        dryRun: false,
      });
    }
  }

  const logger = getLogger(isVerbose);
  const host = new NxScopedHostForMigrations(normalize(root));
  const workflow = new MigrationsWorkflow(host, logger as any);
  return workflow
    .execute({
      collection,
      schematic,
      options: {},
      debug: false,
      logger: logger as any,
    })
    .toPromise();
}

function convertEventTypeToHandleMultipleConfigNames(
  host: Tree,
  eventPath: string,
  content: Buffer | never
) {
  const actualConfigName = host.exists('/workspace.json')
    ? 'workspace.json'
    : 'angular.json';
  const isWorkspaceConfig =
    eventPath === 'angular.json' || eventPath === 'workspace.json';
  if (isWorkspaceConfig) {
    let isNewFormat = true;
    try {
      isNewFormat =
        parseJson(host.read(actualConfigName, 'utf-8')).version === 2;
    } catch (e) {}

    if (content && isNewFormat) {
      const formatted = toNewFormat(parseJson(content.toString()));
      if (formatted) {
        return {
          eventPath: actualConfigName,
          content: Buffer.from(serializeJson(formatted)),
        };
      } else {
        return { eventPath: actualConfigName, content };
      }
    } else {
      return { eventPath: actualConfigName, content };
    }
  } else {
    return { eventPath, content };
  }
}

let collectionResolutionOverrides = null;
let mockedSchematics = null;

/**
 * By default, Angular Devkit schematic collections will be resolved using the Node resolution.
 * This doesn't work if you are testing schematics that refer to other schematics in the
 * same repo.
 *
 * This function can can be used to override the resolution behaviour.
 *
 * Example:
 *
 * ```typescript
 *   overrideCollectionResolutionForTesting({
 *     '@nrwl/workspace': path.join(__dirname, '../../../../workspace/collection.json'),
 *     '@nrwl/angular': path.join(__dirname, '../../../../angular/collection.json'),
 *     '@nrwl/linter': path.join(__dirname, '../../../../linter/collection.json')
 *   });
 *
 * ```
 */
export function overrideCollectionResolutionForTesting(collections: {
  [name: string]: string;
}) {
  collectionResolutionOverrides = collections;
}

/**
 * If you have an Nx Devkit generator invoking the wrapped Angular Devkit schematic,
 * and you don't want the Angular Devkit schematic to run, you can mock it up using this function.
 *
 * Unfortunately, there are some edge cases in the Nx-Angular devkit integration that
 * can be seen in the unit tests context. This function is useful for handling that as well.
 *
 * In this case, you can mock it up.
 *
 * Example:
 *
 * ```typescript
 *   mockSchematicsForTesting({
 *     'mycollection:myschematic': (tree, params) => {
 *        tree.write('README.md');
 *     }
 *   });
 *
 * ```
 */
export function mockSchematicsForTesting(schematics: {
  [name: string]: (
    host: Tree,
    generatorOptions: { [k: string]: any }
  ) => Promise<void>;
}) {
  mockedSchematics = schematics;
}

export function wrapAngularDevkitSchematic(
  collectionName: string,
  generatorName: string
) {
  return async (host: Tree, generatorOptions: { [k: string]: any }) => {
    if (
      mockedSchematics &&
      mockedSchematics[`${collectionName}:${generatorName}`]
    ) {
      return await mockedSchematics[`${collectionName}:${generatorName}`](
        host,
        generatorOptions
      );
    }

    const emptyLogger = {
      log: (e) => {},
      info: (e) => {},
      warn: (e) => {},
      debug: () => {},
      error: (e) => {},
      fatal: (e) => {},
    } as any;
    emptyLogger.createChild = () => emptyLogger;

    const recorder = (
      event: import('@angular-devkit/schematics').DryRunEvent
    ) => {
      let eventPath = event.path.startsWith('/')
        ? event.path.substr(1)
        : event.path;

      const r = convertEventTypeToHandleMultipleConfigNames(
        host,
        eventPath,
        (event as any).content
      );

      if (event.kind === 'error') {
      } else if (event.kind === 'update') {
        host.write(r.eventPath, r.content);
      } else if (event.kind === 'create') {
        host.write(r.eventPath, r.content);
      } else if (event.kind === 'delete') {
        host.delete(r.eventPath);
      } else if (event.kind === 'rename') {
        host.rename(r.eventPath, event.to);
      }
    };

    const fsHost = new NxScopeHostUsedForWrappedSchematics(
      normalize(host.root),
      host
    );

    const options = {
      generatorOptions,
      dryRun: true,
      interactive: false,
      help: false,
      debug: false,
      collectionName,
      generatorName,
      force: false,
      defaults: false,
    };
    const workflow = createWorkflow(fsHost, host.root, options);

    // used for testing
    if (collectionResolutionOverrides) {
      const r = workflow.engineHost.resolve;
      workflow.engineHost.resolve = (collection, b, c) => {
        if (collectionResolutionOverrides[collection]) {
          return collectionResolutionOverrides[collection];
        } else {
          return r.apply(workflow.engineHost, [collection, b, c]);
        }
      };
    }

    const collection = getCollection(workflow, collectionName);
    const schematic = collection.createSchematic(generatorName, true);
    const res = await runSchematic(
      fsHost,
      host.root,
      workflow,
      emptyLogger,
      options,
      schematic,
      false,
      recorder
    );

    if (res.status !== 0) {
      throw new Error(res.loggingQueue.join('\n'));
    }
  };
}

export async function invokeNew(
  root: string,
  opts: GenerateOptions,
  verbose: boolean
) {
  const logger = getLogger(verbose);
  const fsHost = new NxScopedHost(normalize(root));
  const workflow = createWorkflow(fsHost, root, opts);
  const collection = getCollection(workflow, opts.collectionName);
  const schematic = collection.createSchematic('new', true);
  return (
    await runSchematic(
      fsHost,
      root,
      workflow,
      logger as any,
      { ...opts, generatorName: schematic.description.name },
      schematic
    )
  ).status;
}

let logger: logging.Logger;

const loggerColors: Partial<Record<logging.LogLevel, (s: string) => string>> = {
  warn: (s) => chalk.bold(chalk.yellow(s)),
  error: (s) => {
    if (s.startsWith('NX ')) {
      return `\n${NX_ERROR} ${chalk.bold(chalk.red(s.substr(3)))}\n`;
    }

    return chalk.bold(chalk.red(s));
  },
  info: (s) => {
    if (s.startsWith('NX ')) {
      return `\n${NX_PREFIX} ${chalk.bold(s.substr(3))}\n`;
    }

    return chalk.white(s);
  },
};

export const getLogger = (isVerbose = false): logging.Logger => {
  if (!logger) {
    logger = createConsoleLogger(
      isVerbose,
      process.stdout,
      process.stderr,
      loggerColors
    );
  }
  return logger;
};

const getTargetLogger = (
  executor: string,
  isVerbose = false
): logging.Logger => {
  if (executor !== '@angular-devkit/build-angular:tslint') {
    return getLogger(isVerbose);
  }

  const tslintExecutorLogger = createConsoleLogger(
    isVerbose,
    process.stdout,
    process.stderr,
    {
      ...loggerColors,
      warn: (s) => {
        if (
          s.startsWith(
            `TSLint's support is discontinued and we're deprecating its support in Angular CLI.`
          )
        ) {
          s =
            `TSLint's support is discontinued and the @angular-devkit/build-angular:tslint executor is deprecated.\n` +
            'To start using a modern linter tool, please consider replacing TSLint with ESLint. ' +
            'You can use the "@nrwl/angular:convert-tslint-to-eslint" generator to automatically convert your projects.\n' +
            'For more info, visit https://nx.dev/latest/angular/angular/convert-tslint-to-eslint.';
        }
        return chalk.bold(chalk.yellow(s));
      },
    }
  );
  return tslintExecutorLogger;
};
