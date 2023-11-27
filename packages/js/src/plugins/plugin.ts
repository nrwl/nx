import {
  joinPathFragments,
  normalizePath,
  readJsonFile,
  writeJsonFile,
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  type TargetConfiguration,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import type { PackageJson } from 'nx/src/utils/package-json';
import { dirname, join } from 'path';
import type { ExecutorOptions as TscExecutorOptions } from '../utils/schema';

export const defaultBuildTargetName = 'build';
export const defaultEntryPointFiles = [
  'index.ts',
  'index.js',
  'src/index.ts',
  'src/index.js',
  'main.ts',
  'main.js',
  'src/main.ts',
  'src/main.js',
];
export const defaultTsConfigFiles = ['tsconfig.lib.json', 'tsconfig.json'];

export interface JsPluginOptions {
  /**
   * The name of the build target to use.
   * @default 'build'
   */
  buildTargetName?: string;
  /**
   * The list of possible entry points files to use. Relative to project roots.
   * These files are processed in the order they are specified.
   * @default ['index.ts', 'index.js', 'src/index.ts', 'src/index.js', 'main.ts', 'main.js', 'src/main.ts', 'src/main.js']
   */
  packageMainFiles?: string[];
  /**
   * The list of possible tsconfig files to use. Relative to project roots.
   * These files are processed in the order they are specified. The sole
   * exception is the `tsconfig.json` file, which is always processed last.
   * @default ['tsconfig.lib.json', 'tsconfig.json']
   */
  tsConfigFiles?: string[];
}

type NormalizedJsPluginOptions = Required<JsPluginOptions>;

const cachePath = join(projectGraphCacheDirectory, 'js.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<string, Record<string, TargetConfiguration>>
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<JsPluginOptions> = [
  '**/tsconfig.json',
  (configFilePath, rawOptions, context) => {
    const options = normalizeOptions(rawOptions);
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    const hash = calculateHashForCreateNodes(projectRoot, options, context);
    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : buildJsTargets(configFilePath, projectRoot, options, context);

    calculatedTargets[hash] = targets;

    if (!Object.keys(targets).length) {
      return {};
    }

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          projectType: 'library',
          targets,
        },
      },
    };
  },
];

function buildJsTargets(
  configFilePath: string,
  projectRoot: string,
  options: NormalizedJsPluginOptions,
  context: CreateNodesContext
): Record<string, TargetConfiguration<TscExecutorOptions>> {
  const targets: Record<string, TargetConfiguration<TscExecutorOptions>> = {};

  const buildTscTarget = getBuildTscTarget(
    configFilePath,
    projectRoot,
    options,
    context
  );
  if (buildTscTarget) {
    targets[options.buildTargetName] = buildTscTarget;
  }

  return targets;
}

function getBuildTscTarget(
  baseConfigFilePath: string,
  projectRoot: string,
  options: NormalizedJsPluginOptions,
  context: CreateNodesContext
): TargetConfiguration<TscExecutorOptions> | undefined {
  if (!shouldSetUpTscTarget(projectRoot, context.workspaceRoot)) {
    return undefined;
  }

  const { path: tsConfigPath, config: tsConfig } = getBuildTsConfig(
    baseConfigFilePath,
    options,
    projectRoot,
    context.workspaceRoot
  );

  const entryPoint = getBuildEntryPointFilePath(
    options,
    tsConfig,
    projectRoot,
    context.workspaceRoot
  );

  if (!entryPoint) {
    return undefined;
  }

  const tscTargetDefaults = readTargetDefaultsForTarget(
    options.buildTargetName,
    context.nxJsonConfiguration.targetDefaults,
    '@nx/js:tsc'
  );

  const baseTscTargetConfig: TargetConfiguration<TscExecutorOptions> = {
    executor: '@nx/js:tsc',
    options: {
      outputPath: joinPathFragments(
        projectRoot,
        tsConfig.compilerOptions?.outDir ?? ''
      ),
      main: entryPoint,
      tsConfig: tsConfigPath,
      assets: [joinPathFragments(projectRoot, '*.md')],
      ...tscTargetDefaults?.options,
    },
  };

  const namedInputs = getNamedInputs(projectRoot, context);

  return {
    ...baseTscTargetConfig,
    cache: tscTargetDefaults?.cache ?? true,
    inputs:
      tscTargetDefaults?.inputs ?? 'production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default'],
    outputs: tscTargetDefaults?.outputs ?? ['{options.outputPath}'],
    options: {
      ...baseTscTargetConfig.options,
    },
  };
}

function getBuildTsConfig(
  configFilePath: string,
  options: NormalizedJsPluginOptions,
  projectRoot: string,
  workspaceRoot: string
): {
  path: string;
  config: any;
} {
  const candidates = options.tsConfigFiles.filter(
    // tsconfig.json is always processed last
    (candidate) => candidate !== 'tsconfig.json'
  );
  for (const candidate of candidates) {
    const candidateTsConfigPath = join(workspaceRoot, projectRoot, candidate);

    if (existsSync(candidateTsConfigPath)) {
      return {
        path: joinPathFragments(projectRoot, candidate),
        config: readJsonFile(candidateTsConfigPath),
      };
    }
  }

  const tsConfig = readJsonFile(join(workspaceRoot, configFilePath));

  return { path: configFilePath, config: tsConfig };
}

function shouldSetUpTscTarget(
  projectRoot: string,
  workspaceRoot: string
): boolean {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  if (
    !existsSync(packageJsonPath) ||
    readJsonFile<PackageJson>(packageJsonPath).private
  ) {
    return false;
  }

  // TODO(leo): is there a better way?
  const blacklistedConfigFiles = [
    // angular
    'ng-package.json',
    // cypress
    'cypress.config.js',
    'cypress.config.ts',
    'cypress.config.mjs',
    'cypress.config.mts',
    'cypress.config.cjs',
    'cypress.config.cts',
    // esbuild
    'esbuild.config.js',
    'esbuild.config.ts',
    'esbuild.config.mjs',
    'esbuild.config.mts',
    // playwright
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mts',
    'playwright.config.mjs',
    'playwright.config.cts',
    'playwright.config.cjs',
    // rollup
    'rollup.config.js',
    'rollup.config.ts',
    'rollup.config.mjs',
    'rollup.config.mts',
    // swc
    '.swcrc',
    // vite
    'vite.config.js',
    'vite.config.ts',
    'vite.config.mjs',
    'vite.config.mts',
    // webpack
    'webpack.config.js',
    'webpack.config.ts',
    'webpack.config.mjs',
    'webpack.config.mts',
    'webpack.config.cjs',
    'webpack.config.cts',
  ];

  return blacklistedConfigFiles.every(
    (configFile) => !existsSync(join(workspaceRoot, projectRoot, configFile))
  );
}

function getBuildEntryPointFilePath(
  options: NormalizedJsPluginOptions,
  tsConfig: any,
  projectRoot: string,
  workspaceRoot: string
): string | undefined {
  if (tsConfig.files?.length === 1) {
    return joinPathFragments(projectRoot, tsConfig.files[0]);
  }

  for (const file of options.packageMainFiles) {
    const filePath = join(projectRoot, file);
    if (existsSync(join(workspaceRoot, filePath))) {
      return normalizePath(filePath);
    }
  }

  return undefined;
}

function normalizeOptions(
  options: JsPluginOptions = {}
): NormalizedJsPluginOptions {
  return {
    buildTargetName: options.buildTargetName ?? defaultBuildTargetName,
    packageMainFiles: options.packageMainFiles ?? defaultEntryPointFiles,
    tsConfigFiles: options.tsConfigFiles ?? defaultTsConfigFiles,
  };
}
