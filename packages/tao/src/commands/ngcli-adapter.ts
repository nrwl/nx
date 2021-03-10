/* eslint-disable no-restricted-imports */
import {
  json,
  logging,
  normalize,
  Path,
  schema,
  tags,
  virtualFs,
  workspaces,
} from '@angular-devkit/core';
import * as chalk from 'chalk';
import { createConsoleLogger, NodeJsSyncHost } from '@angular-devkit/core/node';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';
import { GenerateOptions } from './generate';
import { FsTree, Tree } from '../shared/tree';
import {
  toNewFormatOrNull,
  toOldFormatOrNull,
  workspaceConfigName,
} from '@nrwl/tao/src/shared/workspace';
import * as path from 'path';
import { dirname, extname, resolve } from 'path';
import * as stripJsonComments from 'strip-json-comments';
import { FileBuffer } from '@angular-devkit/core/src/virtual-fs/host/interface';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { NX_ERROR, NX_PREFIX } from '../shared/logger';

export async function scheduleTarget(
  root: string,
  opts: {
    project: string;
    target: string;
    configuration: string;
    runOptions: any;
  },
  verbose: boolean
): Promise<Observable<import('@angular-devkit/architect').BuilderOutput>> {
  const { Architect } = require('@angular-devkit/architect');
  const {
    WorkspaceNodeModulesArchitectHost,
  } = require('@angular-devkit/architect/node');

  const logger = getLogger(verbose);
  const fsHost = new NxScopedHost(normalize(root));
  const { workspace } = await workspaces.readWorkspace(
    workspaceConfigName(root),
    workspaces.createWorkspaceHost(fsHost)
  );

  const registry = new json.schema.CoreSchemaRegistry();
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
  fsHost: virtualFs.Host<fs.Stats>,
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
              map((r) => {
                try {
                  const w = JSON.parse(Buffer.from(r).toString());
                  const formatted = toOldFormatOrNull(w);
                  return formatted
                    ? Buffer.from(JSON.stringify(formatted, null, 2))
                    : r;
                } catch (e) {
                  return r;
                }
              })
            );
          } else {
            return super.read(r.actualConfigFileName);
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
          if (r.isNewFormat) {
            try {
              const w = JSON.parse(Buffer.from(content).toString());
              const formatted = toNewFormatOrNull(w);
              if (formatted) {
                return super.write(
                  r.actualConfigFileName,
                  Buffer.from(JSON.stringify(formatted, null, 2))
                );
              } else {
                return super.write(r.actualConfigFileName, content);
              }
            } catch (e) {
              return super.write(r.actualConfigFileName, content);
            }
          } else {
            return super.write(r.actualConfigFileName, content);
          }
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

  protected context(
    path: string
  ): Observable<{
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
                const w = JSON.parse(Buffer.from(r).toString());
                return {
                  isWorkspaceConfig: true,
                  actualConfigFileName,
                  isNewFormat: w.version === 2,
                };
              } catch (e) {
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
        const w = JSON.parse(Buffer.from(match.content).toString());
        const formatted = toOldFormatOrNull(w);
        return of(
          formatted
            ? Buffer.from(JSON.stringify(formatted, null, 2))
            : Buffer.from(match.content)
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
    const json = JSON.parse(Buffer.from(content).toString());
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
    return Buffer.from(JSON.stringify(json, null, 2));
  } catch (e) {
    return content;
  }
}

function processConfigWhenWriting(content: ArrayBuffer) {
  try {
    const json = JSON.parse(Buffer.from(content).toString());
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
    return Buffer.from(JSON.stringify(json, null, 2));
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
  const NodeModulesEngineHost = require('@angular-devkit/schematics/tools')
    .NodeModulesEngineHost;

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
          packageJsonPath = require.resolve(path.join(name, 'package.json'), {
            paths: [process.cwd()],
          });
        } catch (e) {
          // workaround for a bug in node 12
          packageJsonPath = require.resolve(
            path.join(process.cwd(), name, 'package.json')
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const packageJson = require(packageJsonPath);
        let pkgJsonSchematics = packageJson['nx-migrations'];
        if (!pkgJsonSchematics) {
          pkgJsonSchematics = packageJson['ng-update'];
          if (!pkgJsonSchematics) {
            throw new Error(`Could not find migrations in package: "${name}"`);
          }
        }
        if (typeof pkgJsonSchematics != 'string') {
          pkgJsonSchematics = pkgJsonSchematics.migrations;
        }
        collectionPath = resolve(dirname(packageJsonPath), pkgJsonSchematics);
      }

      try {
        if (collectionPath) {
          JSON.parse(
            stripJsonComments(readFileSync(collectionPath).toString())
          );
          return collectionPath;
        }
      } catch (e) {
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
        JSON.parse(host.read(actualConfigName).toString()).version === 2;
    } catch (e) {}

    if (content && isNewFormat) {
      const formatted = toNewFormatOrNull(JSON.parse(content.toString()));
      if (formatted) {
        return {
          eventPath: actualConfigName,
          content: Buffer.from(JSON.stringify(formatted, null, 2)),
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
 * ```
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
 * ```
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
export const getLogger = (isVerbose = false): any => {
  if (!logger) {
    logger = createConsoleLogger(isVerbose, process.stdout, process.stderr, {
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
    });
  }
  return logger;
};
