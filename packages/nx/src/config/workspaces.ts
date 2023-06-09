import { sync as globSync } from 'fast-glob';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { basename, dirname, extname, join } from 'path';
import { performance } from 'perf_hooks';
import { workspaceRoot } from '../utils/workspace-root';
import { readJsonFile, readYamlFile } from '../utils/fileutils';
import { logger, NX_PREFIX } from '../utils/logger';
import {
  loadNxPlugins,
  loadNxPluginsSync,
  readPluginPackageJson,
  registerPluginTSTranspiler,
} from '../utils/nx-plugin';

import type { NxJsonConfiguration, TargetDefaults } from './nx-json';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
  TargetConfiguration,
} from './workspace-json-project-json';
import {
  CustomHasher,
  Executor,
  ExecutorConfig,
  ExecutorsJson,
  Generator,
  GeneratorsJson,
  GeneratorsJsonEntry,
  TaskGraphExecutor,
} from './misc-interfaces';
import { PackageJson } from '../utils/package-json';
import { output } from '../utils/output';
import { joinPathFragments } from '../utils/path';
import {
  mergeAngularJsonAndProjects,
  shouldMergeAngularProjects,
} from '../adapter/angular-json';
import { getNxRequirePaths } from '../utils/installation-directory';
import { getIgnoredGlobs } from '../utils/ignore';
import {
  findProjectForPath,
  normalizeProjectRoot,
} from '../project-graph/utils/find-project-for-path';

export class Workspaces {
  private cachedProjectsConfig: ProjectsConfigurations;

  constructor(private root: string) {}

  relativeCwd(cwd: string) {
    return path.relative(this.root, cwd).replace(/\\/g, '/') || null;
  }

  calculateDefaultProjectName(
    cwd: string,
    { projects }: ProjectsConfigurations,
    nxJson: NxJsonConfiguration
  ) {
    const relativeCwd = this.relativeCwd(cwd);
    if (relativeCwd) {
      const matchingProject = findMatchingProjectInCwd(projects, relativeCwd);
      // We have found a project
      if (matchingProject) {
        // That is not at the root
        if (
          projects[matchingProject].root !== '.' &&
          projects[matchingProject].root !== ''
        ) {
          return matchingProject;
          // But its at the root, and NX_DEFAULT_PROJECT is set
        } else if (process.env.NX_DEFAULT_PROJECT) {
          return process.env.NX_DEFAULT_PROJECT;
          // Its root, and NX_DEFAULT_PROJECT is not set
        } else {
          return matchingProject;
        }
      }
    }
    // There was no matching project in cwd.
    return process.env.NX_DEFAULT_PROJECT ?? nxJson?.defaultProject;
  }

  /**
   * @deprecated
   */
  readProjectsConfigurations(opts?: {
    _ignorePluginInference?: boolean;
    _includeProjectsFromAngularJson?: boolean;
  }): ProjectsConfigurations {
    if (
      this.cachedProjectsConfig &&
      process.env.NX_CACHE_PROJECTS_CONFIG !== 'false'
    ) {
      return this.cachedProjectsConfig;
    }
    const nxJson = this.readNxJson();
    const projectsConfigurations = buildProjectsConfigurationsFromProjectPaths(
      nxJson,
      globForProjectFiles(
        this.root,
        opts?._ignorePluginInference
          ? []
          : getGlobPatternsFromPlugins(
              nxJson,
              getNxRequirePaths(this.root),
              this.root
            ),
        nxJson
      ),
      (path) => readJsonFile(join(this.root, path))
    );
    if (
      shouldMergeAngularProjects(
        this.root,
        opts?._includeProjectsFromAngularJson
      )
    ) {
      projectsConfigurations.projects = mergeAngularJsonAndProjects(
        projectsConfigurations.projects,
        this.root
      );
    }
    this.cachedProjectsConfig = this.mergeTargetDefaultsIntoProjectDescriptions(
      projectsConfigurations,
      nxJson
    );
    return this.cachedProjectsConfig;
  }

  /**
   * Deprecated. Use readProjectsConfigurations
   */
  readWorkspaceConfiguration(opts?: {
    _ignorePluginInference?: boolean;
    _includeProjectsFromAngularJson?: boolean;
  }): ProjectsConfigurations & NxJsonConfiguration {
    const nxJson = this.readNxJson();
    return { ...this.readProjectsConfigurations(opts), ...nxJson };
  }

  private mergeTargetDefaultsIntoProjectDescriptions(
    config: ProjectsConfigurations,
    nxJson: NxJsonConfiguration
  ) {
    for (const proj of Object.values(config.projects)) {
      if (proj.targets) {
        for (const targetName of Object.keys(proj.targets)) {
          const projectTargetDefinition = proj.targets[targetName];
          const defaults = readTargetDefaultsForTarget(
            targetName,
            nxJson.targetDefaults,
            projectTargetDefinition.executor
          );

          if (defaults) {
            proj.targets[targetName] = mergeTargetConfigurations(
              proj,
              targetName,
              defaults
            );
          }
        }
      }
    }
    return config;
  }

  isNxExecutor(nodeModule: string, executor: string) {
    return !this.readExecutor(nodeModule, executor).isNgCompat;
  }

  isNxGenerator(collectionName: string, generatorName: string) {
    return !this.readGenerator(collectionName, generatorName).isNgCompat;
  }

  readExecutor(
    nodeModule: string,
    executor: string
  ): ExecutorConfig & { isNgCompat: boolean } {
    try {
      const { executorsFilePath, executorConfig, isNgCompat } =
        this.readExecutorsJson(nodeModule, executor);
      const executorsDir = path.dirname(executorsFilePath);
      const schemaPath = this.resolveSchema(
        executorConfig.schema,
        executorsDir
      );
      const schema = normalizeExecutorSchema(readJsonFile(schemaPath));

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
        ? this.getImplementationFactory<CustomHasher>(
            executorConfig.hasher,
            executorsDir
          )
        : null;

      return {
        schema,
        implementationFactory,
        batchImplementationFactory,
        hasherFactory,
        isNgCompat,
      };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${nodeModule}:${executor}.\n${e.message}`
      );
    }
  }

  readGenerator(
    collectionName: string,
    generatorName: string
  ): {
    resolvedCollectionName: string;
    normalizedGeneratorName: string;
    schema: any;
    implementationFactory: () => Generator<unknown>;
    isNgCompat: boolean;
    /**
     * @deprecated(v16): This will be removed in v16, use generatorConfiguration.aliases
     */
    aliases: string[];
    generatorConfiguration: GeneratorsJsonEntry;
  } {
    try {
      const {
        generatorsFilePath,
        generatorsJson,
        resolvedCollectionName,
        normalizedGeneratorName,
      } = this.readGeneratorsJson(collectionName, generatorName);
      const generatorsDir = path.dirname(generatorsFilePath);
      const generatorConfig =
        generatorsJson.generators?.[normalizedGeneratorName] ||
        generatorsJson.schematics?.[normalizedGeneratorName];
      const isNgCompat = !generatorsJson.generators?.[normalizedGeneratorName];
      const schemaPath = this.resolveSchema(
        generatorConfig.schema,
        generatorsDir
      );
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
      const normalizedGeneratorConfiguration: GeneratorsJsonEntry = {
        ...generatorConfig,
        aliases: generatorConfig.aliases ?? [],
        hidden: !!generatorConfig.hidden,
      };
      return {
        resolvedCollectionName,
        normalizedGeneratorName,
        schema,
        implementationFactory,
        isNgCompat,
        aliases: generatorConfig.aliases || [],
        generatorConfiguration: normalizedGeneratorConfiguration,
      };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${collectionName}:${generatorName}.\n${e.message}`
      );
    }
  }

  hasNxJson(): boolean {
    const nxJson = path.join(this.root, 'nx.json');
    return existsSync(nxJson);
  }

  readNxJson(): NxJsonConfiguration {
    const nxJson = path.join(this.root, 'nx.json');
    if (existsSync(nxJson)) {
      const nxJsonConfiguration = readJsonFile<NxJsonConfiguration>(nxJson);
      if (nxJsonConfiguration.extends) {
        const extendedNxJsonPath = require.resolve(
          nxJsonConfiguration.extends,
          {
            paths: [dirname(nxJson)],
          }
        );
        const baseNxJson =
          readJsonFile<NxJsonConfiguration>(extendedNxJsonPath);
        return {
          ...baseNxJson,
          ...nxJsonConfiguration,
        };
      } else {
        return nxJsonConfiguration;
      }
    } else {
      try {
        return readJsonFile(
          join(__dirname, '..', '..', 'presets', 'core.json')
        );
      } catch (e) {
        return {};
      }
    }
  }

  private getImplementationFactory<T>(
    implementation: string,
    directory: string
  ): () => T {
    const [implementationModulePath, implementationExportName] =
      implementation.split('#');
    return () => {
      const modulePath = this.resolveImplementation(
        implementationModulePath,
        directory
      );
      if (extname(modulePath) === '.ts') {
        registerPluginTSTranspiler();
      }
      const module = require(modulePath);
      return implementationExportName
        ? module[implementationExportName]
        : module.default ?? module;
    };
  }

  private resolveSchema(schemaPath: string, directory: string): string {
    const maybeSchemaPath = join(directory, schemaPath);
    if (existsSync(maybeSchemaPath)) {
      return maybeSchemaPath;
    }

    return require.resolve(schemaPath, {
      paths: [directory],
    });
  }

  private resolveImplementation(
    implementationModulePath: string,
    directory: string
  ): string {
    const validImplementations = ['', '.js', '.ts'].map(
      (x) => implementationModulePath + x
    );

    for (const maybeImplementation of validImplementations) {
      const maybeImplementationPath = join(directory, maybeImplementation);
      if (existsSync(maybeImplementationPath)) {
        return maybeImplementationPath;
      }

      try {
        return require.resolve(maybeImplementation, {
          paths: [directory],
        });
      } catch {}
    }

    throw new Error(
      `Could not resolve "${implementationModulePath}" from "${directory}".`
    );
  }

  private readExecutorsJson(nodeModule: string, executor: string) {
    const { json: packageJson, path: packageJsonPath } = readPluginPackageJson(
      nodeModule,
      this.resolvePaths()
    );
    const executorsFile = packageJson.executors ?? packageJson.builders;

    if (!executorsFile) {
      throw new Error(
        `The "${nodeModule}" package does not support Nx executors.`
      );
    }

    const executorsFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), executorsFile)
    );
    const executorsJson = readJsonFile<ExecutorsJson>(executorsFilePath);
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
    const isNgCompat = !executorsJson.executors?.[executor];
    return { executorsFilePath, executorConfig, isNgCompat };
  }

  private readGeneratorsJson(
    collectionName: string,
    generator: string
  ): {
    generatorsFilePath: string;
    generatorsJson: GeneratorsJson;
    normalizedGeneratorName: string;
    resolvedCollectionName: string;
  } {
    let generatorsFilePath;
    if (collectionName.endsWith('.json')) {
      generatorsFilePath = require.resolve(collectionName, {
        paths: this.resolvePaths(),
      });
    } else {
      const { json: packageJson, path: packageJsonPath } =
        readPluginPackageJson(collectionName, this.resolvePaths());
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
    const generatorsJson = readJsonFile<GeneratorsJson>(generatorsFilePath);

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
    return {
      generatorsFilePath,
      generatorsJson,
      normalizedGeneratorName,
      resolvedCollectionName: collectionName,
    };
  }

  private resolvePaths() {
    return this.root ? [this.root, __dirname] : [__dirname];
  }
}

function findMatchingProjectInCwd(
  projects: { [projectName: string]: ProjectConfiguration },
  relativeCwd: string
) {
  const projectRootMappings = new Map<string, string>();
  for (const projectName of Object.keys(projects)) {
    const { root } = projects[projectName];
    projectRootMappings.set(normalizeProjectRoot(root), projectName);
  }
  const matchingProject = findProjectForPath(relativeCwd, projectRootMappings);
  return matchingProject;
}

export function normalizeExecutorSchema(
  schema: Partial<ExecutorConfig['schema']>
): ExecutorConfig['schema'] {
  const version = (schema.version ??= 1);
  return {
    version,
    outputCapture:
      schema.outputCapture ?? version < 2 ? 'direct-nodejs' : 'pipe',
    properties:
      !schema.properties || typeof schema.properties !== 'object'
        ? {}
        : schema.properties,
    ...schema,
  };
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

/**
 * Pulled from toFileName in names from @nx/devkit.
 * Todo: Should refactor, not duplicate.
 */
export function toProjectName(fileName: string): string {
  const parts = dirname(fileName).split(/[\/\\]/g);
  return parts[parts.length - 1].toLowerCase();
}

let projectGlobCache: string[];
let projectGlobCacheKey: string;

/**
 * @deprecated Use getGlobPatternsFromPluginsAsync instead.
 */
export function getGlobPatternsFromPlugins(
  nxJson: NxJsonConfiguration,
  paths: string[],
  root = workspaceRoot
): string[] {
  const plugins = loadNxPluginsSync(nxJson?.plugins, paths, root);

  const patterns = [];
  for (const plugin of plugins) {
    if (!plugin.projectFilePatterns) {
      continue;
    }
    for (const filePattern of plugin.projectFilePatterns) {
      patterns.push('**/' + filePattern);
    }
  }

  return patterns;
}

export async function getGlobPatternsFromPluginsAsync(
  nxJson: NxJsonConfiguration,
  paths: string[],
  root = workspaceRoot
): Promise<string[]> {
  const plugins = await loadNxPlugins(nxJson?.plugins, paths, root);

  const patterns = [];
  for (const plugin of plugins) {
    if (!plugin.projectFilePatterns) {
      continue;
    }
    for (const filePattern of plugin.projectFilePatterns) {
      patterns.push('**/' + filePattern);
    }
  }

  return patterns;
}

/**
 * Get the package.json globs from package manager workspaces
 */
export function getGlobPatternsFromPackageManagerWorkspaces(
  root: string
): string[] {
  try {
    const patterns: string[] = [];
    const packageJson = readJsonFile<PackageJson>(join(root, 'package.json'));

    patterns.push(
      ...normalizePatterns(
        Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces?.packages ?? []
      )
    );

    if (existsSync(join(root, 'pnpm-workspace.yaml'))) {
      try {
        const { packages } = readYamlFile<{ packages: string[] }>(
          join(root, 'pnpm-workspace.yaml')
        );
        patterns.push(...normalizePatterns(packages || []));
      } catch (e: unknown) {
        output.warn({
          title: `${NX_PREFIX} Unable to parse pnpm-workspace.yaml`,
          bodyLines: [e.toString()],
        });
      }
    }

    if (existsSync(join(root, 'lerna.json'))) {
      try {
        const { packages } = readJsonFile<any>(join(root, 'lerna.json'));
        patterns.push(
          ...normalizePatterns(packages?.length > 0 ? packages : ['packages/*'])
        );
      } catch (e: unknown) {
        output.warn({
          title: `${NX_PREFIX} Unable to parse lerna.json`,
          bodyLines: [e.toString()],
        });
      }
    }

    // Merge patterns from workspaces definitions
    // TODO(@AgentEnder): update logic after better way to determine root project inclusion
    // Include the root project
    return packageJson.nx ? patterns.concat('package.json') : patterns;
  } catch {
    return [];
  }
}

function normalizePatterns(patterns: string[]): string[] {
  return patterns.map((pattern) =>
    removeRelativePath(
      pattern.endsWith('/package.json')
        ? pattern
        : joinPathFragments(pattern, 'package.json')
    )
  );
}

function removeRelativePath(pattern: string): string {
  return pattern.startsWith('./') ? pattern.substring(2) : pattern;
}

export function globForProjectFiles(
  root: string,
  pluginsGlobPatterns: string[],
  nxJson?: NxJsonConfiguration
) {
  // Deal w/ Caching
  const cacheKey = [root, ...pluginsGlobPatterns].join(',');
  if (
    process.env.NX_PROJECT_GLOB_CACHE !== 'false' &&
    projectGlobCache &&
    cacheKey === projectGlobCacheKey
  ) {
    return projectGlobCache;
  }
  projectGlobCacheKey = cacheKey;

  const _globPatternsFromPackageManagerWorkspaces =
    getGlobPatternsFromPackageManagerWorkspaces(root);

  const globPatternsFromPackageManagerWorkspaces =
    _globPatternsFromPackageManagerWorkspaces ?? [];

  const globsToInclude = globPatternsFromPackageManagerWorkspaces.filter(
    (glob) => !glob.startsWith('!')
  );

  const globsToExclude = globPatternsFromPackageManagerWorkspaces
    .filter((glob) => glob.startsWith('!'))
    .map((glob) => glob.substring(1))
    .map((glob) => (glob.startsWith('/') ? glob.substring(1) : glob));

  const projectGlobPatterns: string[] = [
    'project.json',
    '**/project.json',
    ...globsToInclude,
  ];

  projectGlobPatterns.push(...pluginsGlobPatterns);

  const combinedProjectGlobPattern = '{' + projectGlobPatterns.join(',') + '}';

  performance.mark('start-glob-for-projects');
  /**
   * This configures the files and directories which we always want to ignore as part of file watching
   * and which we know the location of statically (meaning irrespective of user configuration files).
   * This has the advantage of being ignored directly within globSync
   *
   * Other ignored entries will need to be determined dynamically by reading and evaluating the user's
   * .gitignore and .nxignore files below.
   */

  const staticIgnores = [
    'node_modules',
    '**/node_modules',
    'dist',
    '.git',
    ...globsToExclude,
    ...getIgnoredGlobs(root, false),
  ];

  /**
   * TODO: This utility has been implemented multiple times across the Nx codebase,
   * discuss whether it should be moved to a shared location.
   */
  const opts = {
    ignore: staticIgnores,
    absolute: false,
    cwd: root,
    dot: true,
    suppressErrors: true,
  };

  const globResults = globSync(combinedProjectGlobPattern, opts);

  projectGlobCache = deduplicateProjectFiles(globResults);

  // TODO @vsavkin remove after Nx 16
  if (
    projectGlobCache.length === 0 &&
    _globPatternsFromPackageManagerWorkspaces === undefined &&
    nxJson?.extends === 'nx/presets/npm.json'
  ) {
    output.warn({
      title:
        'Nx could not find any projects. Check if you need to configure workspaces in package.json or pnpm-workspace.yaml',
    });
  }

  performance.mark('finish-glob-for-projects');
  performance.measure(
    'glob-for-project-files',
    'start-glob-for-projects',
    'finish-glob-for-projects'
  );
  return projectGlobCache;
}

/**
 * @description Loops through files and reduces them to 1 file per project.
 * @param files Array of files that may represent projects
 */
export function deduplicateProjectFiles(files: string[]): string[] {
  const filtered = new Map();
  files.forEach((file) => {
    const projectFolder = dirname(file);
    const projectFile = basename(file);
    if (filtered.has(projectFolder) && projectFile !== 'project.json') return;
    filtered.set(projectFolder, projectFile);
  });

  return Array.from(filtered.entries()).map(([folder, file]) =>
    join(folder, file)
  );
}

function buildProjectConfigurationFromPackageJson(
  path: string,
  packageJson: { name: string },
  nxJson: NxJsonConfiguration
): ProjectConfiguration & { name: string } {
  const normalizedPath = path.split('\\').join('/');
  const directory = dirname(normalizedPath);

  if (!packageJson.name && directory === '.') {
    throw new Error(
      'Nx requires the root package.json to specify a name if it is being used as an Nx project.'
    );
  }

  let name = packageJson.name ?? toProjectName(normalizedPath);
  if (nxJson?.npmScope) {
    const npmPrefix = `@${nxJson.npmScope}/`;
    if (name.startsWith(npmPrefix)) {
      name = name.replace(npmPrefix, '');
    }
  }
  const projectType =
    nxJson?.workspaceLayout?.appsDir != nxJson?.workspaceLayout?.libsDir &&
    nxJson?.workspaceLayout?.appsDir &&
    directory.startsWith(nxJson.workspaceLayout.appsDir)
      ? 'application'
      : 'library';
  return {
    root: directory,
    sourceRoot: directory,
    name,
    projectType,
  };
}

export function inferProjectFromNonStandardFile(
  file: string
): ProjectConfiguration & { name: string } {
  const directory = dirname(file).split('\\').join('/');

  return {
    name: toProjectName(file),
    root: directory,
  };
}

export function buildProjectsConfigurationsFromProjectPaths(
  nxJson: NxJsonConfiguration,
  projectFiles: string[], // making this parameter allows devkit to pick up newly created projects
  readJson: <T extends Object>(string) => T = <T extends Object>(string) =>
    readJsonFile<T>(string) // making this an arg allows us to reuse in devkit
): ProjectsConfigurations {
  const projects: Record<string, ProjectConfiguration> = {};

  for (const file of projectFiles) {
    const directory = dirname(file).split('\\').join('/');
    const fileName = basename(file);

    if (fileName === 'project.json') {
      //  Nx specific project configuration (`project.json` files) in the same
      // directory as a package.json should overwrite the inferred package.json
      // project configuration.
      const configuration = readJson<ProjectConfiguration>(file);

      configuration.root = directory;

      let name = configuration.name;
      if (!configuration.name) {
        name = toProjectName(file);
      }
      if (!projects[name]) {
        projects[name] = configuration;
      } else {
        logger.warn(
          `Skipping project found at ${directory} since project ${name} already exists at ${projects[name].root}! Specify a unique name for the project to allow Nx to differentiate between the two projects.`
        );
      }
    } else {
      // We can infer projects from package.json files,
      // if a package.json file is in a directory w/o a `project.json` file.
      // this results in targets being inferred by Nx from package scripts,
      // and the root / sourceRoot both being the directory.
      if (fileName === 'package.json') {
        const projectPackageJson = readJson<PackageJson>(file);
        const { name, ...config } = buildProjectConfigurationFromPackageJson(
          file,
          projectPackageJson,
          nxJson
        );
        if (!projects[name]) {
          projects[name] = config;
        } else {
          logger.warn(
            `Skipping project found at ${directory} since project ${name} already exists at ${projects[name].root}! Specify a unique name for the project to allow Nx to differentiate between the two projects.`
          );
        }
      } else {
        // This project was created from an nx plugin.
        // The only thing we know about the file is its location
        const { name, ...config } = inferProjectFromNonStandardFile(file);
        if (!projects[name]) {
          projects[name] = config;
        } else {
          logger.warn(
            `Skipping project inferred from ${file} since project ${name} already exists.`
          );
        }
      }
    }
  }

  return {
    version: 2,
    projects: projects,
  };
}

export function mergeTargetConfigurations(
  projectConfiguration: ProjectConfiguration,
  target: string,
  targetDefaults: TargetDefaults[string]
): TargetConfiguration {
  const targetConfiguration = projectConfiguration.targets?.[target];

  if (!targetConfiguration) {
    throw new Error(
      `Attempted to merge targetDefaults for ${projectConfiguration.name}.${target}, which doesn't exist.`
    );
  }

  const {
    configurations: defaultConfigurations,
    options: defaultOptions,
    ...defaults
  } = targetDefaults;
  const result = {
    ...defaults,
    ...targetConfiguration,
  };

  // Target is "compatible", e.g. executor is defined only once or is the same
  // in both places. This means that it is likely safe to merge options
  if (
    !targetDefaults.executor ||
    !targetConfiguration.executor ||
    targetDefaults.executor === targetConfiguration.executor
  ) {
    result.options = mergeOptions(
      defaultOptions,
      targetConfiguration.options ?? {},
      projectConfiguration,
      target
    );
    result.configurations = mergeConfigurations(
      defaultConfigurations,
      targetConfiguration.configurations,
      projectConfiguration,
      target
    );
  }
  return result as TargetConfiguration;
}

function mergeOptions<T extends Object>(
  defaults: T,
  options: T,
  project: ProjectConfiguration,
  key: string
): T {
  return {
    ...resolvePathTokensInOptions(defaults, project, key),
    ...options,
  };
}

function mergeConfigurations<T extends Object>(
  defaultConfigurations: Record<string, T>,
  projectDefinedConfigurations: Record<string, T>,
  project: ProjectConfiguration,
  targetName: string
): Record<string, T> {
  const configurations: Record<string, T> = { ...projectDefinedConfigurations };
  for (const configuration in defaultConfigurations) {
    configurations[configuration] = mergeOptions(
      defaultConfigurations[configuration],
      configurations[configuration],
      project,
      `${targetName}.${configuration}`
    );
  }
  return configurations;
}

function resolvePathTokensInOptions<T extends Object | Array<unknown>>(
  object: T,
  project: ProjectConfiguration,
  key: string
): T {
  const result: T = Array.isArray(object) ? ([...object] as T) : { ...object };
  for (let [opt, value] of Object.entries(object ?? {})) {
    if (typeof value === 'string') {
      if (value.startsWith('{workspaceRoot}/')) {
        value = value.replace(/^\{workspaceRoot\}\//, '');
      }
      if (value.includes('{workspaceRoot}')) {
        throw new Error(
          `${NX_PREFIX} The {workspaceRoot} token is only valid at the beginning of an option. (${key})`
        );
      }
      value = value.replace(/\{projectRoot\}/g, project.root);
      result[opt] = value.replace(/\{projectName\}/g, project.name);
    } else if (typeof value === 'object' && value) {
      result[opt] = resolvePathTokensInOptions(
        value,
        project,
        [key, opt].join('.')
      );
    }
  }
  return result;
}

export function readTargetDefaultsForTarget(
  targetName: string,
  targetDefaults: TargetDefaults,
  executor?: string
): TargetDefaults[string] {
  if (executor) {
    // If an executor is defined in project.json, defaults should be read
    // from the most specific key that matches that executor.
    // e.g. If executor === run-commands, and the target is named build:
    // Use, use nx:run-commands if it is present
    // If not, use build if it is present.
    const key = [executor, targetName].find((x) => targetDefaults?.[x]);
    return key ? targetDefaults?.[key] : null;
  } else {
    // If the executor is not defined, the only key we have is the target name.
    return targetDefaults?.[targetName];
  }
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
