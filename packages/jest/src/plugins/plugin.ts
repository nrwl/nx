import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import {
  clearRequireCache,
  loadConfigFile,
} from '@nx/devkit/src/utils/config-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { minimatch } from 'minimatch';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from 'node:path';
import { hashObject } from 'nx/src/devkit-internals';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { getNxRequirePaths } from 'nx/src/utils/installation-directory';
import { deriveGroupNameFromTarget } from 'nx/src/utils/plugins';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { major } from 'semver';
import { getInstalledJestMajorVersion } from '../utils/versions';

const pmc = getPackageManagerCommand();

export interface JestPluginOptions {
  targetName?: string;
  ciTargetName?: string;

  /**
   * The name that should be used to group atomized tasks on CI
   */
  ciGroupName?: string;
  /**
   *  Whether to use jest-config and jest-runtime are used to load Jest configuration and context.
   *  Disabling this is much faster but could be less correct since we are using our own config loader
   *  and test matcher instead of Jest's.
   */
  disableJestRuntime?: boolean;
}

type JestTargets = Awaited<ReturnType<typeof buildJestTargets>>;

function readTargetsCache(cachePath: string): Record<string, JestTargets> {
  return process.env.NX_CACHE_PROJECT_GRAPH !== 'false' && existsSync(cachePath)
    ? readJsonFile(cachePath)
    : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, JestTargets>
) {
  writeJsonFile(cachePath, results);
}

const jestConfigGlob = '**/jest.config.{cjs,mjs,js,cts,mts,ts}';

export const createNodes: CreateNodesV2<JestPluginOptions> = [
  jestConfigGlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `jest-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);
    // Cache jest preset(s) to avoid penalties of module load times. Most of jest configs will use the same preset.
    const presetCache: Record<string, unknown> = {};

    const isInPackageManagerWorkspaces = buildPackageJsonWorkspacesMatcher(
      context.workspaceRoot
    );

    options = normalizeOptions(options);

    const { roots: projectRoots, configFiles: validConfigFiles } =
      configFiles.reduce(
        (acc, configFile) => {
          const potentialRoot = dirname(configFile);
          if (
            checkIfConfigFileShouldBeProject(
              configFile,
              potentialRoot,
              isInPackageManagerWorkspaces,
              context
            )
          ) {
            acc.roots.push(potentialRoot);
            acc.configFiles.push(configFile);
          }
          return acc;
        },
        {
          roots: [],
          configFiles: [],
        } as {
          roots: string[];
          configFiles: string[];
        }
      );

    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      options,
      context
    );

    try {
      return await createNodesFromFiles(
        async (configFilePath, options, context, idx) => {
          const projectRoot = projectRoots[idx];
          const hash = hashes[idx];

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
        },
        validConfigFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodesV2 = createNodes;

function buildPackageJsonWorkspacesMatcher(
  workspaceRoot: string
): (path: string) => boolean {
  if (process.env.NX_INFER_ALL_PACKAGE_JSONS === 'true') {
    return () => true;
  }

  const packageManagerWorkspacesGlob = combineGlobPatterns(
    getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot)
  );

  return (path: string) => minimatch(path, packageManagerWorkspacesGlob);
}

function checkIfConfigFileShouldBeProject(
  configFilePath: string,
  projectRoot: string,
  isInPackageManagerWorkspaces: (path: string) => boolean,
  context: CreateNodesContextV2
): boolean {
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return false;
  } else if (
    !siblingFiles.includes('project.json') &&
    siblingFiles.includes('package.json')
  ) {
    const path = joinPathFragments(projectRoot, 'package.json');

    const isPackageJsonProject = isInPackageManagerWorkspaces(path);

    if (!isPackageJsonProject) {
      return false;
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
    return false;
  }
  return true;
}

async function buildJestTargets(
  configFilePath: string,
  projectRoot: string,
  options: JestPluginOptions,
  context: CreateNodesContextV2,
  presetCache: Record<string, unknown>
): Promise<Pick<ProjectConfiguration, 'targets' | 'metadata'>> {
  const absConfigFilePath = resolve(context.workspaceRoot, configFilePath);

  if (require.cache[absConfigFilePath]) clearRequireCache();
  const rawConfig = await loadConfigFile(
    absConfigFilePath,
    // lookup for the same files we look for in the resolver and fall back to tsconfig.json
    [
      'tsconfig.spec.json',
      'tsconfig.test.json',
      'tsconfig.jest.json',
      'tsconfig.json',
    ]
  );

  const targets: Record<string, TargetConfiguration> = {};
  const namedInputs = getNamedInputs(projectRoot, context);

  const tsNodeCompilerOptions = JSON.stringify({
    moduleResolution: 'node10',
    module: 'commonjs',
    customConditions: null,
  });

  // Jest 30 + Node.js 24 can't parse TS configs with imports.
  // This flag does not exist in Node 20/22.
  // https://github.com/jestjs/jest/issues/15682
  const nodeVersion = major(process.version);

  const env: Record<string, string> = {
    TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions,
  };

  if (nodeVersion >= 24) {
    const currentOptions = process.env.NODE_OPTIONS || '';
    if (!currentOptions.includes('--no-experimental-strip-types')) {
      env.NODE_OPTIONS = (
        currentOptions + ' --no-experimental-strip-types'
      ).trim();
    }
  }

  const target: TargetConfiguration = (targets[options.targetName] = {
    command: 'jest',
    options: {
      cwd: projectRoot,
      // Jest registers ts-node with module CJS https://github.com/SimenB/jest/blob/v29.6.4/packages/jest-config/src/readConfigFileAndSetRootDir.ts#L117-L119
      // We want to support of ESM via 'module':'nodenext', we need to override the resolution until Jest supports it.
      env,
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

  // Not normalizing it here since also affects options for convert-to-inferred.
  const disableJestRuntime = options.disableJestRuntime !== false;

  const cache = (target.cache = true);
  const inputs = (target.inputs = getInputs(
    namedInputs,
    rawConfig.preset,
    projectRoot,
    context.workspaceRoot,
    disableJestRuntime
  ));

  let metadata: ProjectConfiguration['metadata'];

  const groupName =
    options?.ciGroupName ?? deriveGroupNameFromTarget(options?.ciTargetName);

  if (disableJestRuntime) {
    const outputs = (target.outputs = getOutputs(
      projectRoot,
      rawConfig.coverageDirectory
        ? join(context.workspaceRoot, projectRoot, rawConfig.coverageDirectory)
        : undefined,
      undefined,
      context
    ));

    if (options?.ciTargetName) {
      const { specs, testMatch } = await getTestPaths(
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

      for (const testPath of specs) {
        const relativePath = normalizePath(
          relative(join(context.workspaceRoot, projectRoot), testPath)
        );

        if (relativePath.includes('../')) {
          throw new Error(
            '@nx/jest/plugin attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
              `\n\n${JSON.stringify(
                {
                  projectRoot,
                  relativePath,
                  specs,
                  context,
                  testMatch,
                },
                null,
                2
              )}`
          );
        }

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
            env,
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
    let config;
    try {
      config = await readConfig(
        {
          _: [],
          $0: undefined,
        },
        rawConfig,
        undefined,
        dirname(absConfigFilePath)
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

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
          ? await source.getTestPaths(config.globalConfig, config.projectConfig)
          : // @ts-expect-error Jest v29 doesn't have the projectConfig parameter
            await source.getTestPaths(config.globalConfig);

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

          if (relativePath.includes('../')) {
            throw new Error(
              '@nx/jest/plugin attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
                `\n\n${JSON.stringify(
                  {
                    projectRoot,
                    relativePath,
                    testPaths,
                    context,
                  },
                  null,
                  2
                )}`
            );
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
              env,
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
  const absoluteProjectRoot = join(workspaceRoot, projectRoot);
  const presetModule = jestResolve.findNodeModule(presetPath, {
    basedir: absoluteProjectRoot,
    extensions: ['.json', '.js', '.cjs', '.mjs'],
  });

  if (!presetModule) {
    return null;
  }

  if (isNpmPackage) {
    return { externalDependencies: [presetValue] };
  }

  const relativePath = relative(absoluteProjectRoot, presetModule);
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
  context: CreateNodesContextV2
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
    paths: [projectRoot, ...getNxRequirePaths(workspaceRoot), __dirname],
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
  context: CreateNodesContextV2,
  presetCache: Record<string, unknown>
): Promise<{ specs: string[]; testMatch: string[] }> {
  const testMatch = await getJestOption<string[]>(
    rawConfig,
    absConfigFilePath,
    'testMatch',
    presetCache
  );

  let paths = await globWithWorkspaceContext(
    context.workspaceRoot,
    (
      testMatch || [
        // Default copied from https://github.com/jestjs/jest/blob/d1a2ed7/packages/jest-config/src/Defaults.ts#L84
        '**/__tests__/**/*.?([mc])[jt]s?(x)',
        '**/?(*.)+(spec|test).?([mc])[jt]s?(x)',
      ]
    ).map((pattern) => join(projectRoot, pattern)),
    []
  );

  const testRegex = await getJestOption<string[]>(
    rawConfig,
    absConfigFilePath,
    'testRegex',
    presetCache
  );
  if (testRegex) {
    const testRegexes = Array.isArray(rawConfig.testRegex)
      ? rawConfig.testRegex.map((r: string) => new RegExp(r))
      : [new RegExp(rawConfig.testRegex)];
    paths = paths.filter((path: string) =>
      testRegexes.some((r: RegExp) => r.test(path))
    );
  }

  return { specs: paths, testMatch };
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
