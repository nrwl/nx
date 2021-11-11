import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { readJsonFile } from '../utils/fileutils';
import type { NxJsonConfiguration } from './nx';
import { TaskGraph } from './tasks';
import { logger } from './logger';
import { sync as globSync } from 'fast-glob';
import ignore from 'ignore';
import { basename, dirname, join, toNamespacedPath } from 'path';
import { performance } from 'perf_hooks';

export interface Workspace
  extends WorkspaceJsonConfiguration,
    NxJsonConfiguration {
  projects: Record<string, ProjectConfiguration>;
}

/**
 * Workspace configuration
 */
export interface WorkspaceJsonConfiguration {
  /**
   * Version of the configuration format
   */
  version: number;
  /**
   * Projects' configurations
   */
  projects: {
    [projectName: string]: ProjectConfiguration;
  };
}

export interface RawWorkspaceJsonConfiguration
  extends Omit<WorkspaceJsonConfiguration, 'projects'> {
  projects: { [projectName: string]: ProjectConfiguration | string };
}

/**
 * Type of project supported
 */
export type ProjectType = 'library' | 'application';

/**
 * Project configuration
 */
export interface ProjectConfiguration {
  /**
   * Project's name. Optional if specified in workspace.json
   */
  name?: string;

  /**
   * Project's targets
   */
  targets?: { [targetName: string]: TargetConfiguration };

  /**
   * Project's location relative to the root of the workspace
   */
  root: string;

  /**
   * The location of project's sources relative to the root of the workspace
   */
  sourceRoot?: string;

  /**
   * Project type
   */
  projectType?: ProjectType;

  /**
   * List of default values used by generators.
   *
   * These defaults are project specific.
   *
   * Example:
   *
   * ```
   * {
   *   "@nrwl/react": {
   *     "library": {
   *       "style": "scss"
   *     }
   *   }
   * }
   * ```
   */
  generators?: { [collectionName: string]: { [generatorName: string]: any } };

  /**
   * List of projects which are added as a dependency
   */
  implicitDependencies?: string[];

  /**
   * List of tags used by nx-enforce-module-boundaries / dep-graph
   */
  tags?: string[];
}

export interface TargetDependencyConfig {
  /**
   * This the projects that the targets belong to
   *
   * 'self': This target depends on another target of the same project
   * 'deps': This target depends on targets of the projects of it's deps.
   */
  projects: 'self' | 'dependencies';

  /**
   * The name of the target
   */
  target: string;
}

/**
 * Target's configuration
 */
export interface TargetConfiguration {
  /**
   * The executor/builder used to implement the target.
   *
   * Example: '@nrwl/web:rollup'
   */
  executor: string;

  /**
   * List of the target's outputs. The outputs will be cached by the Nx computation
   * caching engine.
   */
  outputs?: string[];

  /**
   * This describes other targets that a target depends on.
   */
  dependsOn?: [TargetDependencyConfig];

  /**
   * Target's options. They are passed in to the executor.
   */
  options?: any;

  /**
   * Sets of options
   */
  configurations?: { [config: string]: any };

  /**
   * A default named configuration to use when a target configuration is not provided.
   */
  defaultConfiguration?: string;
}

export function workspaceConfigName(root: string) {
  if (existsSync(path.join(root, 'angular.json'))) {
    return 'angular.json';
  } else {
    return 'workspace.json';
  }
}

/**
 * A callback function that is executed after changes are made to the file system
 */
export type GeneratorCallback = () => void | Promise<void>;

/**
 * A function that schedules updates to the filesystem to be done atomically
 */
export type Generator<T = unknown> = (
  tree,
  schema: T
) => void | GeneratorCallback | Promise<void | GeneratorCallback>;

export interface ExecutorConfig {
  schema: any;
  hasherFactory?: () => any;
  implementationFactory: () => Executor;
  batchImplementationFactory?: () => TaskGraphExecutor;
}

/**
 * Implementation of a target of a project
 */
export type Executor<T = any> = (
  /**
   * Options that users configure or pass via the command line
   */
  options: T,
  context: ExecutorContext
) =>
  | Promise<{ success: boolean }>
  | AsyncIterableIterator<{ success: boolean }>;

/**
 * Implementation of a target of a project that handles multiple projects to be batched
 */
export type TaskGraphExecutor<T = any> = (
  /**
   * Graph of Tasks to be executed
   */
  taskGraph: TaskGraph,
  /**
   * Map of Task IDs to options for the task
   */
  options: Record<string, T>,
  /**
   * Set of overrides for the overall execution
   */
  overrides: T,
  context: ExecutorContext
) => Promise<Record<string, { success: boolean; terminalOutput: string }>>;

/**
 * Context that is passed into an executor
 */
export interface ExecutorContext {
  /**
   * The root of the workspace
   */
  root: string;

  /**
   * The name of the project being executed on
   */
  projectName?: string;

  /**
   * The name of the target being executed
   */
  targetName?: string;

  /**
   * The name of the configuration being executed
   */
  configurationName?: string;

  /**
   * The configuration of the target being executed
   */
  target?: TargetConfiguration;

  /**
   * The full workspace configuration
   */
  workspace: WorkspaceJsonConfiguration & NxJsonConfiguration;

  /**
   * The current working directory
   */
  cwd: string;

  /**
   * Enable verbose logging
   */
  isVerbose: boolean;
}

export class Workspaces {
  constructor(private root: string) {}

  relativeCwd(cwd: string) {
    return path.relative(this.root, cwd) || null;
  }

  calculateDefaultProjectName(
    cwd: string,
    wc: WorkspaceJsonConfiguration & NxJsonConfiguration
  ) {
    const relativeCwd = this.relativeCwd(cwd);
    if (relativeCwd) {
      const matchingProject = Object.keys(wc.projects).find((p) => {
        const projectRoot = wc.projects[p].root;
        return (
          relativeCwd == projectRoot ||
          relativeCwd.startsWith(`${projectRoot}/`)
        );
      });
      if (matchingProject) return matchingProject;
    }
    return wc.defaultProject;
  }

  readWorkspaceConfiguration(): WorkspaceJsonConfiguration &
    NxJsonConfiguration {
    const nxJsonPath = path.join(this.root, 'nx.json');
    const nxJson = existsSync(nxJsonPath)
      ? readJsonFile<NxJsonConfiguration>(nxJsonPath)
      : ({} as NxJsonConfiguration);
    const workspacePath = path.join(this.root, workspaceConfigName(this.root));
    const workspace = existsSync(workspacePath)
      ? this.readFromWorkspaceJson()
      : buildWorkspaceConfigurationFromGlobs(
          nxJson,
          globForProjectFiles(this.root),
          (path) => readJsonFile(join(this.root, path))
        );

    assertValidWorkspaceConfiguration(nxJson);
    return { ...workspace, ...nxJson };
  }

  isNxExecutor(nodeModule: string, executor: string) {
    const schema = this.readExecutor(nodeModule, executor).schema;
    return schema['cli'] === 'nx';
  }

  isNxGenerator(collectionName: string, generatorName: string) {
    const schema = this.readGenerator(collectionName, generatorName).schema;
    return schema['cli'] === 'nx';
  }

  readExecutor(nodeModule: string, executor: string): ExecutorConfig {
    try {
      const { executorsFilePath, executorConfig } = this.readExecutorsJson(
        nodeModule,
        executor
      );
      const executorsDir = path.dirname(executorsFilePath);
      const schemaPath = path.join(executorsDir, executorConfig.schema || '');
      const schema = readJsonFile(schemaPath);
      if (!schema.properties || typeof schema.properties !== 'object') {
        schema.properties = {};
      }
      const implementationFactory = this.getImplementationFactory<Executor>(
        executorConfig.implementation,
        executorsDir
      );

      const batchImplementationFactory = executorConfig.batchImplementation
        ? this.getImplementationFactory<TaskGraphExecutor>(
            executorConfig.batchImplementation,
            executorsDir
          )
        : null;

      const hasherFactory = executorConfig.hasher
        ? this.getImplementationFactory<Function>(
            executorConfig.hasher,
            executorsDir
          )
        : null;

      return {
        schema,
        implementationFactory,
        batchImplementationFactory,
        hasherFactory,
      };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${nodeModule}:${executor}.\n${e.message}`
      );
    }
  }

  readGenerator(collectionName: string, generatorName: string) {
    try {
      const { generatorsFilePath, generatorsJson, normalizedGeneratorName } =
        this.readGeneratorsJson(collectionName, generatorName);
      const generatorsDir = path.dirname(generatorsFilePath);
      const generatorConfig =
        generatorsJson.generators?.[normalizedGeneratorName] ||
        generatorsJson.schematics?.[normalizedGeneratorName];
      const schemaPath = path.join(generatorsDir, generatorConfig.schema || '');
      const schema = readJsonFile(schemaPath);
      if (!schema.properties || typeof schema.properties !== 'object') {
        schema.properties = {};
      }
      generatorConfig.implementation =
        generatorConfig.implementation || generatorConfig.factory;
      const implementationFactory = this.getImplementationFactory<Generator>(
        generatorConfig.implementation,
        generatorsDir
      );
      return { normalizedGeneratorName, schema, implementationFactory };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${collectionName}:${generatorName}.\n${e.message}`
      );
    }
  }

  private getImplementationFactory<T>(
    implementation: string,
    directory: string
  ): () => T {
    const [implementationModulePath, implementationExportName] =
      implementation.split('#');
    return () => {
      const module = require(path.join(directory, implementationModulePath));
      return module[implementationExportName || 'default'] as T;
    };
  }

  private readExecutorsJson(nodeModule: string, executor: string) {
    const packageJsonPath = require.resolve(`${nodeModule}/package.json`, {
      paths: this.resolvePaths(),
    });
    const packageJson = readJsonFile(packageJsonPath);
    const executorsFile = packageJson.executors ?? packageJson.builders;

    if (!executorsFile) {
      throw new Error(
        `The "${nodeModule}" package does not support Nx executors.`
      );
    }

    const executorsFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), executorsFile)
    );
    const executorsJson = readJsonFile(executorsFilePath);
    const executorConfig: {
      implementation: string;
      batchImplementation?: string;
      schema: string;
      hasher?: string;
    } =
      executorsJson.executors?.[executor] || executorsJson.builders?.[executor];
    if (!executorConfig) {
      throw new Error(
        `Cannot find executor '${executor}' in ${executorsFilePath}.`
      );
    }
    return { executorsFilePath, executorConfig };
  }

  private readGeneratorsJson(collectionName: string, generator: string) {
    let generatorsFilePath;
    if (collectionName.endsWith('.json')) {
      generatorsFilePath = require.resolve(collectionName, {
        paths: this.resolvePaths(),
      });
    } else {
      const packageJsonPath = require.resolve(
        `${collectionName}/package.json`,
        {
          paths: this.resolvePaths(),
        }
      );
      const packageJson = readJsonFile(packageJsonPath);
      const generatorsFile = packageJson.generators ?? packageJson.schematics;

      if (!generatorsFile) {
        throw new Error(
          `The "${collectionName}" package does not support Nx generators.`
        );
      }

      generatorsFilePath = require.resolve(
        path.join(path.dirname(packageJsonPath), generatorsFile)
      );
    }
    const generatorsJson = readJsonFile(generatorsFilePath);

    let normalizedGeneratorName =
      findFullGeneratorName(generator, generatorsJson.generators) ||
      findFullGeneratorName(generator, generatorsJson.schematics);

    if (!normalizedGeneratorName) {
      for (let parent of generatorsJson.extends || []) {
        try {
          return this.readGeneratorsJson(parent, generator);
        } catch (e) {}
      }

      throw new Error(
        `Cannot find generator '${generator}' in ${generatorsFilePath}.`
      );
    }
    return { generatorsFilePath, generatorsJson, normalizedGeneratorName };
  }

  private resolvePaths() {
    return this.root ? [this.root, __dirname] : [__dirname];
  }

  private readFromWorkspaceJson() {
    const rawWorkspace = readJsonFile(
      path.join(this.root, workspaceConfigName(this.root))
    );
    return resolveNewFormatWithInlineProjects(rawWorkspace, this.root);
  }
}

function assertValidWorkspaceConfiguration(
  nxJson: NxJsonConfiguration & { projects?: any }
) {
  // Assert valid workspace configuration
  if (nxJson.projects) {
    logger.error(
      'NX As of Nx 13, project configuration should be moved from nx.json to workspace.json/project.json. Please run "nx format" to fix this.'
    );
    process.exit(1);
  }
}

function findFullGeneratorName(
  name: string,
  generators: {
    [name: string]: { aliases?: string[] };
  }
) {
  if (generators) {
    for (let [key, data] of Object.entries<{ aliases?: string[] }>(
      generators
    )) {
      if (
        key === name ||
        (data.aliases && (data.aliases as string[]).includes(name))
      ) {
        return key;
      }
    }
  }
}

export function reformattedWorkspaceJsonOrNull(w: any) {
  return w.version === 2 ? toNewFormatOrNull(w) : toOldFormatOrNull(w);
}

export function toNewFormat(w: any): WorkspaceJsonConfiguration {
  const f = toNewFormatOrNull(w);
  return f ?? w;
}

export function toNewFormatOrNull(w: any) {
  let formatted = false;
  Object.values(w.projects || {}).forEach((projectConfig: any) => {
    if (projectConfig.architect) {
      renamePropertyWithStableKeys(projectConfig, 'architect', 'targets');
      formatted = true;
    }
    if (projectConfig.schematics) {
      renamePropertyWithStableKeys(projectConfig, 'schematics', 'generators');
      formatted = true;
    }
    Object.values(projectConfig.targets || {}).forEach((target: any) => {
      if (target.builder !== undefined) {
        renamePropertyWithStableKeys(target, 'builder', 'executor');
        formatted = true;
      }
    });
  });
  if (w.schematics) {
    renamePropertyWithStableKeys(w, 'schematics', 'generators');
    formatted = true;
  }
  if (w.version !== 2) {
    w.version = 2;
    formatted = true;
  }
  return formatted ? w : null;
}

export function toOldFormatOrNull(w: any) {
  let formatted = false;

  Object.values(w.projects || {}).forEach((projectConfig: any) => {
    if (typeof projectConfig === 'string') {
      throw new Error(
        "'project.json' files are incompatible with version 1 workspace schemas."
      );
    }
    if (projectConfig.targets) {
      renamePropertyWithStableKeys(projectConfig, 'targets', 'architect');
      formatted = true;
    }
    if (projectConfig.generators) {
      renamePropertyWithStableKeys(projectConfig, 'generators', 'schematics');
      formatted = true;
    }
    Object.values(projectConfig.architect || {}).forEach((target: any) => {
      if (target.executor !== undefined) {
        renamePropertyWithStableKeys(target, 'executor', 'builder');
        formatted = true;
      }
    });
  });

  if (w.generators) {
    renamePropertyWithStableKeys(w, 'generators', 'schematics');
    formatted = true;
  }
  if (w.version !== 1) {
    w.version = 1;
    formatted = true;
  }
  return formatted ? w : null;
}

export function resolveOldFormatWithInlineProjects(
  w: any,
  root: string = appRootPath
) {
  const inlined = inlineProjectConfigurations(w, root);
  const formatted = toOldFormatOrNull(inlined);
  return formatted ? formatted : inlined;
}

export function resolveNewFormatWithInlineProjects(
  w: any,
  root: string = appRootPath
) {
  return toNewFormat(inlineProjectConfigurations(w, root));
}

export function inlineProjectConfigurations(
  w: any,
  root: string = appRootPath
) {
  Object.entries(w.projects || {}).forEach(
    ([project, config]: [string, any]) => {
      if (typeof config === 'string') {
        const configFilePath = path.join(root, config, 'project.json');
        const fileConfig = readJsonFile(configFilePath);
        w.projects[project] = fileConfig;
      }
    }
  );
  return w;
}

/**
 * Pulled from toFileName in names from @nrwl/devkit.
 * Todo: Should refactor, not duplicate.
 */
export function toProjectName(
  fileName: string,
  nxJson: NxJsonConfiguration
): string {
  const directory = dirname(fileName);
  const { appsDir, libsDir } = nxJson.workspaceLayout || {};
  const regex = new RegExp(
    `^(?:${appsDir || 'apps'}|${libsDir || 'libs'})/`,
    'g'
  );
  const subpath = directory.replace(regex, '');
  return subpath
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _\/]/g, '-');
}

let projectGlobCache: string[];
export function globForProjectFiles(root) {
  if (projectGlobCache) return projectGlobCache;
  performance.mark('start-glob-for-projects');
  /**
   * This configures the files and directories which we always want to ignore as part of file watching
   * and which we know the location of statically (meaning irrespective of user configuration files).
   * This has the advantage of being ignored directly within globSync
   *
   * Other ignored entries will need to be determined dynamically by reading and evaluating the user's
   * .gitignore and .nxignore files below.
   */
  const ALWAYS_IGNORE = [
    join(root, 'node_modules'),
    join(root, 'dist'),
    join(root, '.git'),
  ];

  /**
   * TODO: This utility has been implemented multiple times across the Nx codebase,
   * discuss whether it should be moved to a shared location.
   */
  const ig = ignore();
  try {
    ig.add(readFileSync(`${root}/.gitignore`, 'utf-8'));
  } catch {}
  try {
    ig.add(readFileSync(`${root}/.nxignore`, 'utf-8'));
  } catch {}

  projectGlobCache = globSync('**/@(project.json|package.json)', {
    ignore: ALWAYS_IGNORE,
    absolute: false,
    cwd: root,
    // If part of .nxignore, .gitignore, or the root package.json
  }).filter((file) => !ig.ignores(file) && file !== 'package.json');
  performance.mark('finish-glob-for-projects');
  performance.measure(
    'glob-for-project-files',
    'start-glob-for-projects',
    'finish-glob-for-projects'
  );
  return projectGlobCache;
}

export function buildProjectConfigurationFromPackageJson(
  path: string,
  packageJson: { name: string },
  nxJson: NxJsonConfiguration
): ProjectConfiguration & { name: string } {
  const directory = dirname(path).split('\\').join('/');
  const npmPrefix = `@${nxJson.npmScope}/`;
  let { name } = packageJson;
  if (name.startsWith(npmPrefix)) {
    name = name.replace(npmPrefix, '');
  }
  return {
    root: directory,
    sourceRoot: directory,
    name,
  };
}

export function buildWorkspaceConfigurationFromGlobs(
  nxJson: NxJsonConfiguration,
  projectFiles: string[] = globForProjectFiles(appRootPath), // making this parameter allows devkit to pick up newly created projects
  readJson: (string) => any = readJsonFile // making this an arg allows us to reuse in devkit
): WorkspaceJsonConfiguration {
  const configurations: Record<string, ProjectConfiguration> = {};
  // For package.json inferred projects, we need the name
  // of the inferred project. This is used to overwrite the
  // inferred project if a project.json file is also found.
  const projectsFromPackageJsons = new Map<string, string>();
  // For `project.json` projects, we don't need the name,
  // but we need to know if one has already been found in
  // a directory. This is used to skip inferring a new project
  // from package.json in the same directory.
  const projectsFromProjectJsons = new Set<string>();

  for (const file of projectFiles) {
    const directory = dirname(file).split('\\').join('/');
    const fileName = basename(file) as 'project.json' | 'package.json';

    // We can infer projects from package.json files,
    // if a package.json file is in a directory w/o a `project.json` file.
    // this results in targets being inferred by Nx from package scripts,
    // and the root / sourceRoot both being the directory.
    if (
      fileName === 'package.json' &&
      !projectsFromProjectJsons.has(directory)
    ) {
      const { name, ...config } = buildProjectConfigurationFromPackageJson(
        file,
        readJson(file),
        nxJson
      );
      if (configurations[name]) {
        continue;
      }
      configurations[name] = config;

      projectsFromPackageJsons.set(directory, name);
    } else if (fileName === 'project.json') {
      //  Nx specific project configuration (`project.json` files) in the same
      // directory as a package.json should overwrite the inferred package.json
      // project configuration.
      if (projectsFromPackageJsons.has(directory)) {
        const oldName = projectsFromPackageJsons.get(directory);
        delete configurations[oldName];
        projectsFromPackageJsons.delete(directory);
      }
      const configuration = readJson(file);
      let name = configuration.name;
      if (!configuration.name) {
        name = toProjectName(file, nxJson);
      }
      if (!configurations[name]) {
        configurations[name] = configuration;
        projectsFromProjectJsons.add(directory);
      } else {
        logger.warn(
          `Skipping project found at ${directory} since project ${name} already exists!`
        );
      }
    }
  }

  return {
    version: 2,
    projects: configurations,
  };
}

// we have to do it this way to preserve the order of properties
// not to screw up the formatting
export function renamePropertyWithStableKeys(
  obj: any,
  from: string,
  to: string
) {
  const copy = { ...obj };
  Object.keys(obj).forEach((k) => {
    delete obj[k];
  });
  Object.keys(copy).forEach((k) => {
    if (k === from) {
      obj[to] = copy[k];
    } else {
      obj[k] = copy[k];
    }
  });
}
