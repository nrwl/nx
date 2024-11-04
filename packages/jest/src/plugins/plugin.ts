import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  normalizePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import {
  clearRequireCache,
  loadConfigFile,
} from '@nx/devkit/src/utils/config-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { minimatch } from 'minimatch';
import { hashObject } from 'nx/src/devkit-internals';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { getInstalledJestMajorVersion } from '../utils/version-utils';
import {
  getFilesInDirectoryUsingContext,
  globWithWorkspaceContext,
} from 'nx/src/utils/workspace-context';
import { normalize } from 'node:path';

const pmc = getPackageManagerCommand();

export interface JestPluginOptions {
  targetName?: string;
  ciTargetName?: string;
  /**
   *  Whether to use jest-config and jest-runtime to load Jest configuration and context.
   *  Disabling this is much faster but could be less correct since we are using our own config loader
   *  and test matcher instead of Jest's.
   */
  disableJestRuntime?: boolean;
}

type JestTargets = Awaited<ReturnType<typeof buildJestTargets>>;

function readTargetsCache(cachePath: string): Record<string, JestTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, JestTargets>
) {
  writeJsonFile(cachePath, results);
}

const jestConfigGlob = '**/jest.config.{cjs,mjs,js,cts,mts,ts}';

export const createNodesV2: CreateNodesV2<JestPluginOptions> = [
  jestConfigGlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `jest-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);
    // Cache jest preset(s) to avoid penalties of module load times. Most of jest configs will use the same preset.
    const presetCache: Record<string, unknown> = {};

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            presetCache
          ),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

/**
 * @deprecated This is replaced with {@link createNodesV2}. Update your plugin to export its own `createNodesV2` function that wraps this one instead.
 * This function will change to the v2 function in Nx 20.
 */
export const createNodes: CreateNodes<JestPluginOptions> = [
  jestConfigGlob,
  (...args) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );

    return createNodesInternal(...args, {}, {});
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: JestPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, JestTargets>,
  presetCache: Record<string, unknown>
) {
  const projectRoot = dirname(configFilePath);

  const packageManagerWorkspacesGlob = combineGlobPatterns(
    getGlobPatternsFromPackageManagerWorkspaces(context.workspaceRoot)
  );

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  } else if (
    !siblingFiles.includes('project.json') &&
    siblingFiles.includes('package.json')
  ) {
    const path = joinPathFragments(projectRoot, 'package.json');

    const isPackageJsonProject = minimatch(path, packageManagerWorkspacesGlob);

    if (!isPackageJsonProject) {
      return {};
    }
  }

  const jestConfigContent = readFileSync(
    resolve(context.workspaceRoot, configFilePath),
    'utf-8'
  );
  if (jestConfigContent.includes('getJestProjectsAsync()')) {
    // The `getJestProjectsAsync` function uses the project graph, which leads to a
    // circular dependency. We can skip this since it's no intended to be used for
    // an Nx project.
    return {};
  }

  options = normalizeOptions(options);

  const hash = await calculateHashForCreateNodes(projectRoot, options, context);
  targetsCache[hash] ??= await buildJestTargets(
    configFilePath,
    projectRoot,
    options,
    context,
    presetCache
  );

  const { targets, metadata } = targetsCache[hash];

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata,
      },
    },
  };
}

async function buildJestTargets(
  configFilePath: string,
  projectRoot: string,
  options: JestPluginOptions,
  context: CreateNodesContext,
  presetCache: Record<string, unknown>
): Promise<Pick<ProjectConfiguration, 'targets' | 'metadata'>> {
  const absConfigFilePath = resolve(context.workspaceRoot, configFilePath);

  if (require.cache[absConfigFilePath]) clearRequireCache();
  const rawConfig = await loadConfigFile(absConfigFilePath);

  const targets: Record<string, TargetConfiguration> = {};
  const namedInputs = getNamedInputs(projectRoot, context);

  const target: TargetConfiguration = (targets[options.targetName] = {
    command: 'jest',
    options: {
      cwd: projectRoot,
    },
    metadata: {
      technologies: ['jest'],
      description: 'Run Jest Tests',
      help: {
        command: `${pmc.exec} jest --help`,
        example: {
          options: {
            coverage: true,
          },
        },
      },
    },
  });

  const cache = (target.cache = true);
  const inputs = (target.inputs = getInputs(
    namedInputs,
    rawConfig.preset,
    projectRoot,
    context.workspaceRoot,
    options.disableJestRuntime
  ));

  let metadata: ProjectConfiguration['metadata'];

  const groupName = 'E2E (CI)';

  if (options.disableJestRuntime) {
    const outputs = (target.outputs = getOutputs(
      projectRoot,
      rawConfig.coverageDirectory
        ? join(context.workspaceRoot, projectRoot, rawConfig.coverageDirectory)
        : undefined,
      undefined,
      context
    ));

    if (options?.ciTargetName) {
      const testPaths = await getTestPaths(
        projectRoot,
        rawConfig,
        absConfigFilePath,
        context,
        presetCache
      );
      const targetGroup = [];
      const dependsOn: string[] = [];
      metadata = {
        targetGroups: {
          [groupName]: targetGroup,
        },
      };

      const specIgnoreRegexes: undefined | RegExp[] =
        rawConfig.testPathIgnorePatterns?.map(
          (p: string) => new RegExp(replaceRootDirInPath(projectRoot, p))
        );

      for (const testPath of testPaths) {
        const relativePath = normalizePath(
          relative(join(context.workspaceRoot, projectRoot), testPath)
        );

        if (specIgnoreRegexes?.some((regex) => regex.test(relativePath))) {
          continue;
        }

        const targetName = `${options.ciTargetName}--${relativePath}`;
        dependsOn.push(targetName);
        targets[targetName] = {
          command: `jest ${relativePath}`,
          cache,
          inputs,
          outputs,
          options: {
            cwd: projectRoot,
          },
          metadata: {
            technologies: ['jest'],
            description: `Run Jest Tests in ${relativePath}`,
            help: {
              command: `${pmc.exec} jest --help`,
              example: {
                options: {
                  coverage: true,
                },
              },
            },
          },
        };
        targetGroup.push(targetName);
      }

      if (targetGroup.length > 0) {
        targets[options.ciTargetName] = {
          executor: 'nx:noop',
          cache: true,
          inputs,
          outputs,
          dependsOn,
          metadata: {
            technologies: ['jest'],
            description: 'Run Jest Tests in CI',
            nonAtomizedTarget: options.targetName,
            help: {
              command: `${pmc.exec} jest --help`,
              example: {
                options: {
                  coverage: true,
                },
              },
            },
          },
        };
        targetGroup.unshift(options.ciTargetName);
      }
    }
  } else {
    const { readConfig } = requireJestUtil<typeof import('jest-config')>(
      'jest-config',
      projectRoot,
      context.workspaceRoot
    );
    const config = await readConfig(
      {
        _: [],
        $0: undefined,
      },
      rawConfig,
      undefined,
      dirname(absConfigFilePath)
    );

    const outputs = (target.outputs = getOutputs(
      projectRoot,
      config.globalConfig?.coverageDirectory,
      config.globalConfig?.outputFile,
      context
    ));

    if (options?.ciTargetName) {
      // nx-ignore-next-line
      const { default: Runtime } = requireJestUtil<
        typeof import('jest-runtime')
      >('jest-runtime', projectRoot, context.workspaceRoot);

      const jestContext = await Runtime.createContext(config.projectConfig, {
        maxWorkers: 1,
        watchman: false,
      });

      const jest = require(resolveJestPath(
        projectRoot,
        context.workspaceRoot
      )) as typeof import('jest');
      const source = new jest.SearchSource(jestContext);

      const jestVersion = getInstalledJestMajorVersion()!;
      const specs =
        jestVersion >= 30
          ? // @ts-expect-error Jest 30+ expects the project config as the second argument
            await source.getTestPaths(config.globalConfig, config.projectConfig)
          : await source.getTestPaths(config.globalConfig);

      const testPaths = new Set(specs.tests.map(({ path }) => path));

      if (testPaths.size > 0) {
        const targetGroup = [];
        metadata = {
          targetGroups: {
            [groupName]: targetGroup,
          },
        };
        const dependsOn: string[] = [];

        targets[options.ciTargetName] = {
          executor: 'nx:noop',
          cache: true,
          inputs,
          outputs,
          dependsOn,
          metadata: {
            technologies: ['jest'],
            description: 'Run Jest Tests in CI',
            nonAtomizedTarget: options.targetName,
            help: {
              command: `${pmc.exec} jest --help`,
              example: {
                options: {
                  coverage: true,
                },
              },
            },
          },
        };
        targetGroup.push(options.ciTargetName);

        for (const testPath of testPaths) {
          const relativePath = normalizePath(
            relative(join(context.workspaceRoot, projectRoot), testPath)
          );
          const targetName = `${options.ciTargetName}--${relativePath}`;
          dependsOn.push(targetName);
          targets[targetName] = {
            command: `jest ${relativePath}`,
            cache,
            inputs,
            outputs,
            options: {
              cwd: projectRoot,
            },
            metadata: {
              technologies: ['jest'],
              description: `Run Jest Tests in ${relativePath}`,
              help: {
                command: `${pmc.exec} jest --help`,
                example: {
                  options: {
                    coverage: true,
                  },
                },
              },
            },
          };
          targetGroup.push(targetName);
        }
      }
    }
  }

  return { targets, metadata };
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs'],
  preset: string,
  projectRoot: string,
  workspaceRoot: string,
  disableJestRuntime?: boolean
): TargetConfiguration['inputs'] {
  const inputs: TargetConfiguration['inputs'] = [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
  ];

  const externalDependencies = ['jest'];
  const presetInput = disableJestRuntime
    ? resolvePresetInputWithoutJestResolver(preset, projectRoot, workspaceRoot)
    : resolvePresetInputWithJestResolver(preset, projectRoot, workspaceRoot);
  if (presetInput) {
    if (
      typeof presetInput !== 'string' &&
      'externalDependencies' in presetInput
    ) {
      externalDependencies.push(...presetInput.externalDependencies);
    } else {
      inputs.push(presetInput);
    }
  }

  inputs.push({ externalDependencies });

  return inputs;
}

function resolvePresetInputWithoutJestResolver(
  presetValue: string | undefined,
  projectRoot: string,
  workspaceRoot: string
): TargetConfiguration['inputs'][number] | null {
  if (!presetValue) return null;

  const presetPath = replaceRootDirInPath(projectRoot, presetValue);
  const isNpmPackage = !presetValue.startsWith('.') && !isAbsolute(presetPath);

  if (isNpmPackage) {
    return { externalDependencies: [presetValue] };
  }

  if (presetPath.startsWith('..')) {
    const relativePath = relative(workspaceRoot, join(projectRoot, presetPath));
    return join('{workspaceRoot}', relativePath);
  } else {
    const relativePath = relative(projectRoot, presetPath);
    return join('{projectRoot}', relativePath);
  }
}

// preset resolution adapted from:
// https://github.com/jestjs/jest/blob/c54bccd657fb4cf060898717c09f633b4da3eec4/packages/jest-config/src/normalize.ts#L122
function resolvePresetInputWithJestResolver(
  presetValue: string | undefined,
  projectRoot: string,
  workspaceRoot: string
): TargetConfiguration['inputs'][number] | null {
  if (!presetValue) return null;

  let presetPath = replaceRootDirInPath(projectRoot, presetValue);
  const isNpmPackage = !presetValue.startsWith('.') && !isAbsolute(presetPath);
  presetPath = presetPath.startsWith('.')
    ? presetPath
    : join(presetPath, 'jest-preset');
  const { default: jestResolve } = requireJestUtil<
    typeof import('jest-resolve')
  >('jest-resolve', projectRoot, workspaceRoot);
  const presetModule = jestResolve.findNodeModule(presetPath, {
    basedir: projectRoot,
    extensions: ['.json', '.js', '.cjs', '.mjs'],
  });

  if (!presetModule) {
    return null;
  }

  if (isNpmPackage) {
    return { externalDependencies: [presetValue] };
  }

  const relativePath = relative(join(workspaceRoot, projectRoot), presetModule);
  return relativePath.startsWith('..')
    ? join('{workspaceRoot}', join(projectRoot, relativePath))
    : join('{projectRoot}', relativePath);
}

// Adapted from here https://github.com/jestjs/jest/blob/c13bca3/packages/jest-config/src/utils.ts#L57-L69
function replaceRootDirInPath(rootDir: string, filePath: string): string {
  if (!filePath.startsWith('<rootDir>')) {
    return filePath;
  }
  return resolve(rootDir, normalize(`./${filePath.slice('<rootDir>'.length)}`));
}

function getOutputs(
  projectRoot: string,
  coverageDirectory: string | undefined,
  outputFile: string | undefined,
  context: CreateNodesContext
): string[] {
  function getOutput(path: string): string {
    const relativePath = relative(
      join(context.workspaceRoot, projectRoot),
      path
    );
    if (relativePath.startsWith('..')) {
      return join('{workspaceRoot}', join(projectRoot, relativePath));
    } else {
      return join('{projectRoot}', relativePath);
    }
  }

  const outputs = [];

  for (const outputOption of [coverageDirectory, outputFile]) {
    if (outputOption) {
      outputs.push(getOutput(outputOption));
    }
  }

  return outputs;
}

function normalizeOptions(options: JestPluginOptions): JestPluginOptions {
  options ??= {};
  options.targetName ??= 'test';
  return options;
}

let resolvedJestPaths: Record<string, string>;

function resolveJestPath(projectRoot: string, workspaceRoot: string): string {
  resolvedJestPaths ??= {};
  if (resolvedJestPaths[projectRoot]) {
    return resolvedJestPaths[projectRoot];
  }

  resolvedJestPaths[projectRoot] = require.resolve('jest', {
    paths: [projectRoot, workspaceRoot, __dirname],
  });

  return resolvedJestPaths[projectRoot];
}

let resolvedJestCorePaths: Record<string, string>;

/**
 * Resolves a jest util package version that `jest` is using.
 */
function requireJestUtil<T>(
  packageName: string,
  projectRoot: string,
  workspaceRoot: string
): T {
  const jestPath = resolveJestPath(projectRoot, workspaceRoot);

  resolvedJestCorePaths ??= {};
  if (!resolvedJestCorePaths[jestPath]) {
    // nx-ignore-next-line
    resolvedJestCorePaths[jestPath] = require.resolve('@jest/core', {
      paths: [dirname(jestPath)],
    });
  }

  return require(require.resolve(packageName, {
    paths: [dirname(resolvedJestCorePaths[jestPath])],
  }));
}

async function getTestPaths(
  projectRoot: string,
  rawConfig: any,
  absConfigFilePath: string,
  context: CreateNodesContext,
  presetCache: Record<string, unknown>
): Promise<string[]> {
  const testMatch = await getJestOption<string[]>(
    rawConfig,
    absConfigFilePath,
    'testMatch',
    presetCache
  );
  if (testMatch) {
    return await globWithWorkspaceContext(
      context.workspaceRoot,
      testMatch.map((pattern) => join(projectRoot, pattern)),
      []
    );
  } else {
    const testRegex = await getJestOption<string[]>(
      rawConfig,
      absConfigFilePath,
      'testRegex',
      presetCache
    );
    if (testRegex) {
      const files: string[] = [];
      const testRegexes = Array.isArray(rawConfig.testRegex)
        ? rawConfig.testRegex.map((r: string) => new RegExp(r))
        : [new RegExp(rawConfig.testRegex)];
      const projectFiles = await getFilesInDirectoryUsingContext(
        context.workspaceRoot,
        projectRoot
      );
      for (const file of projectFiles) {
        if (testRegexes.some((r: RegExp) => r.test(file))) files.push(file);
      }
      return files;
    } else {
      // Default copied from https://github.com/jestjs/jest/blob/d1a2ed7/packages/jest-config/src/Defaults.ts#L84
      const defaultTestMatch = [
        '**/__tests__/**/*.?([mc])[jt]s?(x)',
        '**/?(*.)+(spec|test).?([mc])[jt]s?(x)',
      ];
      return await globWithWorkspaceContext(
        context.workspaceRoot,
        defaultTestMatch.map((pattern) => join(projectRoot, pattern)),
        []
      );
    }
  }
}

async function getJestOption<T = any>(
  rawConfig: any,
  absConfigFilePath: string,
  optionName: string,
  presetCache: Record<string, unknown>
): Promise<T> {
  if (rawConfig[optionName]) return rawConfig[optionName];

  if (rawConfig.preset) {
    const dir = dirname(absConfigFilePath);
    const presetPath = resolve(dir, rawConfig.preset);
    try {
      let preset = presetCache[presetPath];
      if (!preset) {
        preset = await loadConfigFile(presetPath);
        presetCache[presetPath] = preset;
      }
      if (preset[optionName]) return preset[optionName];
    } catch {
      // If preset fails to load, ignore the error and continue.
      // This is safe and less jarring for users. They will need to fix the
      // preset for Jest to run, and at that point we can read in the correct
      // value.
    }
  }

  return undefined;
}
