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
import { detectPackageManager } from '../utils/package-manager';
import { GenerateOptions } from '../command-line/generate';
import { FileChange, Tree } from '../config/tree';
import {
  buildWorkspaceConfigurationFromGlobs,
  globForProjectFiles,
  toNewFormat,
  toNewFormatOrNull,
  toOldFormatOrNull,
  workspaceConfigName,
} from '../config/workspaces';
import { dirname, extname, resolve, join, basename } from 'path';
import { FileBuffer } from '@angular-devkit/core/src/virtual-fs/host/interface';
import type { Architect } from '@angular-devkit/architect';
import { Observable, of, merge, forkJoin, NEVER } from 'rxjs';
import { catchError, map, switchMap, toArray, tap } from 'rxjs/operators';
import { NX_ERROR, NX_PREFIX } from '../utils/logger';
import { readJsonFile } from '../utils/fileutils';
import { parseJson, serializeJson } from '../utils/json';
import { NxJsonConfiguration } from '../config/nx-json';
import {
  ProjectConfiguration,
  RawWorkspaceJsonConfiguration,
  WorkspaceJsonConfiguration,
} from '../config/workspace-json-project-json';

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
  const fsHost = new NxScopedHost(root);
  const { workspace } = await workspaces.readWorkspace(
    workspaceConfigName(root),
    workspaces.createWorkspaceHost(fsHost)
  );

  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const architectHost = new WorkspaceNodeModulesArchitectHost(workspace, root);
  const architect: Architect = new Architect(architectHost, registry);
  const run = await architect.scheduleTarget(
    {
      project: opts.project,
      target: opts.target,
      configuration: opts.configuration,
    },
    opts.runOptions,
    { logger }
  );

  let lastOutputError: string;
  return run.output.pipe(
    tap(
      (output) =>
        (lastOutputError = !output.success ? output.error : undefined),
      (error) => {}, // do nothing, this could be an intentional error
      () => {
        lastOutputError ? logger.error(lastOutputError) : 0;
      }
    )
  );
}

function createWorkflow(
  fsHost: virtualFs.Host<Stats>,
  root: string,
  opts: any
) {
  const NodeWorkflow = require('@angular-devkit/schematics/tools').NodeWorkflow;
  const workflow = new NodeWorkflow(fsHost, {
    force: false,
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
  if (opts.interactive) {
    workflow.registry.usePromptProvider(createPromptProvider());
  }
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
      ? event.path.slice(1)
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
        debug: false,
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

type AngularJsonConfiguration = WorkspaceJsonConfiguration &
  Pick<NxJsonConfiguration, 'cli' | 'defaultProject' | 'generators'> & {
    schematics?: NxJsonConfiguration['generators'];
  };
export class NxScopedHost extends virtualFs.ScopedHost<any> {
  protected __nxInMemoryWorkspace: WorkspaceJsonConfiguration | null;

  constructor(private root: string) {
    super(new NodeJsSyncHost(), normalize(root));
  }

  protected __readWorkspaceConfiguration = (
    configFileName: ChangeContext['actualConfigFileName'],
    overrides?: {
      workspace?: Observable<RawWorkspaceJsonConfiguration>;
      nx?: Observable<NxJsonConfiguration>;
    }
  ): Observable<FileBuffer> => {
    const readJsonFile = (path: string) =>
      super
        .read(path as Path)
        .pipe(map((data) => JSON.parse(Buffer.from(data).toString())));

    const readWorkspaceJsonFile = (
      nxJson: NxJsonConfiguration
    ): Observable<RawWorkspaceJsonConfiguration> => {
      if (overrides?.workspace) {
        return overrides.workspace;
      } else if (this.__nxInMemoryWorkspace) {
        return of(this.__nxInMemoryWorkspace);
      } else {
        if (configFileName) {
          return super
            .read(configFileName)
            .pipe(map((data) => parseJson(Buffer.from(data).toString())));
        } else {
          const staticProjects = globForProjectFiles(this.root);
          this.__nxInMemoryWorkspace = buildWorkspaceConfigurationFromGlobs(
            nxJson,
            staticProjects.filter((x) => basename(x) !== 'package.json')
          );
          Object.entries(this.__nxInMemoryWorkspace.projects).forEach(
            ([project, config]) => {
              this.__nxInMemoryWorkspace.projects[project] = config.root as any;
            }
          );
          return of(this.__nxInMemoryWorkspace);
        }
      }
    };

    const readNxJsonFile = () => {
      if (overrides?.nx) {
        return overrides.nx;
      }
      return readJsonFile('nx.json');
    };

    return super.exists('nx.json' as Path).pipe(
      switchMap((nxJsonExists) => {
        let nxJsonObservable: Observable<NxJsonConfiguration> = NEVER;
        if (nxJsonExists) {
          nxJsonObservable = readNxJsonFile();
        } else {
          nxJsonObservable = of({} as NxJsonConfiguration);
        }
        const workspaceJsonObservable: Observable<RawWorkspaceJsonConfiguration> =
          nxJsonObservable.pipe(switchMap((x) => readWorkspaceJsonFile(x)));
        return forkJoin([nxJsonObservable, workspaceJsonObservable]);
      }),
      switchMap(([nxJson, workspaceJson]) => {
        try {
          // resolve inline configurations and downlevel format
          return this.resolveInlineProjectConfigurations(workspaceJson).pipe(
            map((x) => {
              const angularJson: AngularJsonConfiguration = x;
              // assign props ng cli expects from nx json, if it exists
              angularJson.cli ??= nxJson?.cli;
              angularJson.generators ??= nxJson?.generators;
              angularJson.defaultProject ??= nxJson?.defaultProject;

              if (workspaceJson.version === 2) {
                const formatted = toOldFormatOrNull(workspaceJson);
                return formatted
                  ? Buffer.from(serializeJson(formatted))
                  : Buffer.from(serializeJson(x));
              }
              return Buffer.from(serializeJson(x));
            })
          );
        } catch {
          return of(Buffer.from(serializeJson(workspaceJson)));
        }
      })
    );
  };

  read(path: Path): Observable<FileBuffer> {
    return this.context(path).pipe(
      switchMap((r) => {
        if (r.isWorkspaceConfig) {
          return this.__readWorkspaceConfiguration(r.actualConfigFileName);
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
          return of(true); // isWorkspaceConfig means its a file
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
          return of(true);
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

  protected context(path: string): Observable<ChangeContext> {
    if (isWorkspaceConfigPath(path)) {
      return forkJoin([
        super.exists('/angular.json' as Path),
        super.exists('/workspace.json' as Path),
      ]).pipe(
        switchMap(([isAngularJson, isWorkspaceJson]) => {
          if (!isAngularJson && !isWorkspaceJson) {
            return of({
              isWorkspaceConfig: true,
              actualConfigFileName: null,
              // AngularJson / WorkspaceJson v2 is always used for standalone project config
              isNewFormat: true,
            });
          }
          const actualConfigFileName = isAngularJson
            ? ('/angular.json' as Path)
            : ('/workspace.json' as Path);
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

  private writeWorkspaceConfiguration(
    context: ChangeContext,
    content
  ): Observable<void> {
    const config = parseJson(Buffer.from(content).toString());
    if (context.isNewFormat) {
      try {
        const w = parseJson(Buffer.from(content).toString());
        const formatted: AngularJsonConfiguration = toNewFormatOrNull(w);
        if (formatted) {
          const { cli, generators, defaultProject, ...workspaceJson } =
            formatted;
          return merge(
            this.writeWorkspaceConfigFiles(context, workspaceJson),
            cli || generators || defaultProject
              ? this.__saveNxJsonProps({ cli, generators, defaultProject })
              : of(null)
          );
        } else {
          const {
            cli,
            schematics,
            generators,
            defaultProject,
            ...angularJson
          } = w;
          return merge(
            this.writeWorkspaceConfigFiles(context, angularJson),
            cli || schematics
              ? this.__saveNxJsonProps({
                  cli,
                  defaultProject,
                  generators: schematics || generators,
                })
              : of(null)
          );
        }
      } catch (e) {}
    }
    const { cli, schematics, generators, defaultProject, ...angularJson } =
      config;
    return merge(
      this.writeWorkspaceConfigFiles(context, angularJson),
      this.__saveNxJsonProps({
        cli,
        defaultProject,
        generators: schematics || generators,
      })
    );
  }

  private __saveNxJsonProps(
    props: Partial<NxJsonConfiguration>
  ): Observable<void> {
    const nxJsonPath = 'nx.json' as Path;
    return super.read(nxJsonPath).pipe(
      switchMap((buf) => {
        const nxJson = parseJson(Buffer.from(buf).toString());
        Object.assign(nxJson, props);
        return super.write(nxJsonPath, Buffer.from(serializeJson(nxJson)));
      })
    );
  }

  private writeWorkspaceConfigFiles(
    { actualConfigFileName: workspaceFileName, isNewFormat }: ChangeContext,
    config
  ) {
    // copy to avoid removing inlined config files.
    const writeObservables: Observable<void>[] = [];
    const configToWrite = {
      ...config,
      projects: { ...config.projects },
    };
    const projects: [string, any][] = Object.entries(configToWrite.projects);
    for (const [project, projectConfig] of projects) {
      if (projectConfig.configFilePath) {
        if (workspaceFileName && !isNewFormat) {
          throw new Error(
            'Attempted to write standalone project configuration into a v1 workspace'
          );
        }
        // project was read from a project.json file
        const configPath = projectConfig.configFilePath;
        const fileConfigObject = { ...projectConfig };
        delete fileConfigObject.root; // remove the root before writing
        delete fileConfigObject.configFilePath; // remove the configFilePath before writing
        const projectJsonWrite = super.write(
          configPath,
          Buffer.from(serializeJson(fileConfigObject))
        ); // write back to the project.json file
        writeObservables.push(projectJsonWrite);
        configToWrite.projects[project] = normalize(dirname(configPath)); // update the config object to point to the written file.
      }
    }

    if (workspaceFileName) {
      const workspaceJsonWrite = super.write(
        workspaceFileName,
        Buffer.from(serializeJson(configToWrite))
      );
      writeObservables.push(workspaceJsonWrite);
    }
    return merge(...writeObservables);
  }

  protected resolveInlineProjectConfigurations(
    config: RawWorkspaceJsonConfiguration
  ): Observable<WorkspaceJsonConfiguration> {
    // Creates an observable where each emission is a project configuration
    // that is not listed inside workspace.json. Each time it encounters a
    // standalone config, observable is updated by concatenating the new
    // config read operation.
    const observables: Observable<{
      project: string;
      projectConfig: ProjectConfiguration;
    }>[] = [];
    Object.entries((config.projects as Record<string, any>) ?? {}).forEach(
      ([project, projectConfig]) => {
        if (typeof projectConfig === 'string') {
          // configFilePath is not written to files, but is stored on the config object
          // so that we know where to save the project's configuration if it was updated
          // by another angular schematic.
          const configFilePath = join(projectConfig, 'project.json');
          const next = this.read(configFilePath as Path).pipe(
            map((x) => ({
              project,
              projectConfig: {
                root: dirname(configFilePath),
                ...parseJson(Buffer.from(x).toString()),
                configFilePath,
              },
            }))
          );
          observables.push(next);
        }
      }
    );

    return merge(...observables).pipe(
      toArray(),
      map((configs) => {
        configs.forEach(({ project, projectConfig }) => {
          config.projects[project] = projectConfig;
        });
        return config as WorkspaceJsonConfiguration;
      })
    );
  }
}

type ConfigFilePath = ('/angular.json' | '/workspace.json') & {
  __PRIVATE_DEVKIT_PATH: void;
};

type ChangeContext = {
  isWorkspaceConfig: boolean;
  actualConfigFileName: ConfigFilePath | null;
  isNewFormat: boolean;
};

export class NxScopeHostUsedForWrappedSchematics extends NxScopedHost {
  constructor(root: string, private readonly host: Tree) {
    super(root);
  }

  read(path: Path): Observable<FileBuffer> {
    if (isWorkspaceConfigPath(path)) {
      const nxJsonChange = findMatchingFileChange(this.host, 'nx.json' as Path);
      const match = findWorkspaceConfigFileChange(this.host);

      let workspaceJsonOverride: Observable<RawWorkspaceJsonConfiguration>;
      let actualConfigFileName: ConfigFilePath = [
        '/workspace.json',
        '/angular.json',
      ].filter((f) => this.host.exists(f))[0] as ConfigFilePath;
      if (actualConfigFileName) {
        if (match) {
          workspaceJsonOverride = of(parseJson(match.content.toString()));
        }
      } else if (!this.__nxInMemoryWorkspace) {
        // if we've already dealt with this, let NxScopedHost read the cache...
        // projects created inside a generator will not be visible
        // to glob when it runs in nx/shared/workspace, so
        // we have to add them into the file.
        const createdProjectFiles = findCreatedProjects(this.host);
        const deletedProjectFiles = findDeletedProjects(this.host);
        const nxJsonInTree = nxJsonChange
          ? parseJson(nxJsonChange.content.toString())
          : parseJson(this.host.read('nx.json').toString());
        const readJsonWithHost = (file) => ({
          root: dirname(file),
          ...parseJson(this.host.read(file).toString()),
        });
        const staticProjects = buildWorkspaceConfigurationFromGlobs(
          nxJsonInTree,
          globForProjectFiles(this.host.root).filter(
            (x) => basename(x) !== 'package.json'
          ),
          readJsonWithHost
        );
        const createdProjects = buildWorkspaceConfigurationFromGlobs(
          nxJsonInTree,
          createdProjectFiles.map((x) => x.path),
          readJsonWithHost
        ).projects;
        deletedProjectFiles.forEach((file) => {
          const matchingStaticProject = Object.entries(
            staticProjects.projects
          ).find(([, config]) => config.root === dirname(file.path));

          if (matchingStaticProject) {
            delete staticProjects.projects[matchingStaticProject[0]];
          }
        });

        const workspace = {
          ...staticProjects,
          projects: { ...staticProjects.projects, ...createdProjects },
        };
        workspaceJsonOverride = of({
          ...workspace,
          // all projects **must** be standalone if workspace.json doesn't exist
          // since the NxScopedHost already handles the standalone config case,
          // lets pass them as standalone.
          projects: Object.fromEntries(
            Object.entries(workspace.projects).map(([project, config]) => [
              project,
              config.root,
            ])
          ),
        });
      }
      // no match, default to existing behavior
      if (!workspaceJsonOverride && !nxJsonChange) {
        return super.read(path);
      }

      // we try to format it, if it changes, return it, otherwise return the original change
      try {
        return this.__readWorkspaceConfiguration(actualConfigFileName, {
          // we are overriding workspaceJson + nxJson,
          workspace: workspaceJsonOverride,
          nx: nxJsonChange
            ? of(parseJson(nxJsonChange.content.toString()))
            : null,
        });
      } catch (e) {
        return super.read(path);
      }
    } else {
      const match = findMatchingFileChange(this.host, path);
      if (match) {
        // found a matching change in the host
        return of(Buffer.from(match.content));
      } else if (
        // found a change to workspace config, and reading a project config file
        basename(path) === 'project.json' &&
        findWorkspaceConfigFileChange(this.host)
      ) {
        return of(this.host.read(path));
      } else {
        // found neither, use default read method
        return super.read(path);
      }
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

type WorkspaceConfigFileChange = FileChange & {
  path: ConfigFilePath;
};
function findWorkspaceConfigFileChange(host: Tree): WorkspaceConfigFileChange {
  return host
    .listChanges()
    .find(
      (f) => f.path == 'workspace.json' || f.path == 'angular.json'
    ) as WorkspaceConfigFileChange;
}

function findCreatedProjects(host: Tree): FileChange[] {
  return host
    .listChanges()
    .filter(
      (f) =>
        (basename(f.path) === 'project.json' ||
          basename(f.path) === 'package.json') &&
        f.type === 'CREATE'
    );
}

function findDeletedProjects(host: Tree): FileChange[] {
  return host
    .listChanges()
    .filter((f) => basename(f.path) === 'project.json' && f.type === 'DELETE');
}

function findMatchingFileChange(host: Tree, path: Path) {
  const targetPath = path.startsWith('/') ? path.substring(1) : path.toString();
  return host
    .listChanges()
    .find((f) => f.path === targetPath && f.type !== 'DELETE');
}

function isWorkspaceConfigPath(p: Path | string) {
  return (
    p === 'angular.json' ||
    p === '/angular.json' ||
    p === 'workspace.json' ||
    p === '/workspace.json'
  );
}

export async function generate(
  root: string,
  opts: GenerateOptions,
  verbose: boolean
) {
  const logger = getLogger(verbose);
  const fsHost = new NxScopedHost(root);
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

function createPromptProvider() {
  interface Prompt {
    name: string;
    type: 'input' | 'select' | 'multiselect' | 'confirm' | 'numeral';
    message: string;
    initial?: any;
    choices?: (string | { name: string; message: string })[];
    validate?: (value: string) => boolean | string;
  }

  return (definitions: Array<any>) => {
    const questions: Prompt[] = definitions.map((definition) => {
      const question: Prompt = {
        name: definition.id,
        message: definition.message,
      } as any;

      if (definition.default) {
        question.initial = definition.default;
      }

      const validator = definition.validator;
      if (validator) {
        question.validate = (input) => validator(input);
      }

      switch (definition.type) {
        case 'string':
        case 'input':
          return { ...question, type: 'input' };
        case 'boolean':
        case 'confirmation':
        case 'confirm':
          return { ...question, type: 'confirm' };
        case 'number':
        case 'numeral':
          return { ...question, type: 'numeral' };
        case 'list':
          return {
            ...question,
            type: !!definition.multiselect ? 'multiselect' : 'select',
            choices:
              definition.items &&
              definition.items.map((item) => {
                if (typeof item == 'string') {
                  return item;
                } else {
                  return {
                    message: item.label,
                    name: item.value,
                  };
                }
              }),
          };
        default:
          return { ...question, type: definition.type };
      }
    });

    return require('enquirer').prompt(questions);
  };
}

export async function runMigration(
  root: string,
  packageName: string,
  migrationName: string,
  isVerbose: boolean
) {
  const logger = getLogger(isVerbose);
  const fsHost = new NxScopedHost(root);
  const workflow = createWorkflow(fsHost, root, {});
  const collection = resolveMigrationsCollection(packageName);
  return workflow
    .execute({
      collection,
      schematic: migrationName,
      options: {},
      debug: false,
      logger: logger as any,
    })
    .toPromise();
}

function resolveMigrationsCollection(name: string): string {
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

function convertEventTypeToHandleMultipleConfigNames(
  host: Tree,
  eventPath: string,
  content: Buffer | never
) {
  const actualConfigName = host.exists('/angular.json')
    ? 'angular.json'
    : 'workspace.json';
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
 *     '@nrwl/workspace': path.join(__dirname, '../../../../workspace/generators.json'),
 *     '@nrwl/angular': path.join(__dirname, '../../../../angular/generators.json'),
 *     '@nrwl/linter': path.join(__dirname, '../../../../linter/generators.json')
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
        ? event.path.slice(1)
        : event.path;

      const r = convertEventTypeToHandleMultipleConfigNames(
        host,
        eventPath,
        (event as any).content
      );

      if (event.kind === 'error') {
      } else if (event.kind === 'update') {
        if (
          r.eventPath === 'angular.json' ||
          r.eventPath === 'workspace.json'
        ) {
          saveWorkspaceConfigurationInWrappedSchematic(host, r);
        } else {
          host.write(r.eventPath, r.content);
        }
      } else if (event.kind === 'create') {
        host.write(r.eventPath, r.content);
      } else if (event.kind === 'delete') {
        host.delete(r.eventPath);
      } else if (event.kind === 'rename') {
        host.rename(r.eventPath, event.to);
      }
    };

    const fsHost = new NxScopeHostUsedForWrappedSchematics(host.root, host);

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
  const fsHost = new NxScopedHost(root);
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
      return `\n${NX_ERROR} ${chalk.bold(chalk.red(s.slice(3)))}\n`;
    }

    return chalk.bold(chalk.red(s));
  },
  info: (s) => {
    if (s.startsWith('NX ')) {
      return `\n${NX_PREFIX} ${chalk.bold(s.slice(3))}\n`;
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
            'For more info, visit https://nx.dev/packages/angular/generators/convert-tslint-to-eslint.';
        }
        return chalk.bold(chalk.yellow(s));
      },
    }
  );
  return tslintExecutorLogger;
};

function saveWorkspaceConfigurationInWrappedSchematic(
  host: Tree,
  r: { eventPath: string; content: Buffer }
) {
  const workspaceJsonExists = host.exists(r.eventPath);
  const workspace: Omit<AngularJsonConfiguration, 'projects'> & {
    projects: {
      [key: string]: string | { configFilePath?: string; root: string };
    };
  } = parseJson(r.content.toString());
  for (const [project, config] of Object.entries(workspace.projects)) {
    if (
      typeof config === 'object' &&
      (!workspaceJsonExists || config.configFilePath)
    ) {
      const path = config.configFilePath || join(config.root, 'project.json');
      workspace.projects[project] = normalize(dirname(path));
      delete config.root; // remove the root before writing
      delete config.configFilePath;
      host.write(path, serializeJson(config));
    }
  }
  const nxJson: NxJsonConfiguration = parseJson(
    host.read('nx.json').toString()
  );
  nxJson.generators = workspace.generators || workspace.schematics;
  nxJson.cli = workspace.cli || nxJson.cli;
  nxJson.defaultProject = workspace.defaultProject;
  delete workspace.cli;
  delete workspace.generators;
  delete workspace.schematics;
  if (workspaceJsonExists) {
    r.content = Buffer.from(serializeJson(workspace));
    host.write(r.eventPath, r.content);
  }
}
