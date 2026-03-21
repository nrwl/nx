import {
  calculateHashesForCreateNodes,
  clearRequireCache,
  loadConfigFile,
  getNamedInputs,
} from '@nx/devkit/internal';
import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
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
import { getLockFileName } from '@nx/js';
import {
  walkTsconfigExtendsChain,
  type RawTsconfigJsonCache,
} from '@nx/js/src/internal';
import { getInstalledJestMajorVersion } from '../utils/versions';

const REPORTER_BUILTINS = new Set(['default', 'github-actions', 'summary']);

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
  /**
   * Whether to use Jest's resolver (jest-resolve) for resolving config file
   * references (presets, transforms, setup files, module name mappers, etc.)
   * as task inputs. When false, uses path-based classification which is fast
   * but cannot follow symlinks or honor custom moduleDirectories/modulePaths.
   * Enable this if your config references workspace-linked packages or relies
   * on Jest-specific resolution behavior.
   * @default true when disableJestRuntime is false, false otherwise
   */
  useJestResolver?: boolean;
}

type IsolatedModulesResult = {
  value: boolean | undefined;
  visitedFiles: ReadonlySet<string>;
};

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
    // Cache tsconfig reads + isolatedModules resolution. Many projects share
    // the same base tsconfig in their extends chain — read each file once.
    const tsconfigJsonCache: RawTsconfigJsonCache = new Map();
    const tsconfigExistsCache = new Map<string, boolean>();
    const isolatedModulesCache = new Map<string, IsolatedModulesResult>();

    const isInPackageManagerWorkspaces = buildPackageJsonWorkspacesMatcher(
      context.workspaceRoot
    );

    options = normalizeOptions(options);

    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);

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

    const lockFilePattern = getLockFileName(packageManager);

    // Load configs in parallel. `loadConfigFile` calls `registerTsProject`,
    // whose transpiler dedup is refcounted: serial register/unregister cycles
    // drop refCount to 0 between iterations and recreate a fresh ts-node
    // service each time (ts-node has no cleanup — see
    // packages/nx/src/plugins/js/utils/register.js), stacking N services in
    // `require.extensions` and OOM'ing under NX_PREFER_TS_NODE. Parallel
    // loads keep all registrations alive concurrently so the dedup holds and
    // a single transpiler instance is shared.
    let requireCacheCleared = false;
    const loadedConfigs = await Promise.all(
      validConfigFiles.map(async (configFilePath, i) => {
        const projectRoot = projectRoots[i];
        const absConfigFilePath = resolve(
          context.workspaceRoot,
          configFilePath
        );
        if (!requireCacheCleared && require.cache[absConfigFilePath]) {
          clearRequireCache();
          requireCacheCleared = true;
        }
        const rawConfig = await loadConfigFile(absConfigFilePath, [
          'tsconfig.spec.json',
          'tsconfig.test.json',
          'tsconfig.jest.json',
          'tsconfig.json',
        ]);
        const { externalFiles, needsDtsInputs } =
          await collectExternalFileReferences(
            rawConfig,
            absConfigFilePath,
            projectRoot,
            context.workspaceRoot,
            {
              presetCache,
              tsconfigJsonCache,
              tsconfigExistsCache,
              isolatedModulesCache,
            }
          );
        return { rawConfig, externalFiles, needsDtsInputs };
      })
    );

    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      options,
      context,
      loadedConfigs.map(({ externalFiles }) => [
        lockFilePattern,
        ...externalFiles,
      ])
    );

    try {
      return await createNodesFromFiles(
        async (configFilePath, options, context, idx) => {
          const projectRoot = projectRoots[idx];
          const hash = hashes[idx];
          const { rawConfig, needsDtsInputs } = loadedConfigs[idx];

          targetsCache[hash] ??= await buildJestTargets(
            rawConfig,
            needsDtsInputs,
            configFilePath,
            projectRoot,
            options,
            context,
            presetCache,
            pmc
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
  rawConfig: any,
  needsDtsInputs: boolean,
  configFilePath: string,
  projectRoot: string,
  options: JestPluginOptions,
  context: CreateNodesContextV2,
  presetCache: Record<string, unknown>,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<Pick<ProjectConfiguration, 'targets' | 'metadata'>> {
  const absConfigFilePath = resolve(context.workspaceRoot, configFilePath);

  const targets: Record<string, TargetConfiguration> = {};
  const namedInputs = getNamedInputs(projectRoot, context);

  const tsNodeCompilerOptions = JSON.stringify({
    moduleResolution: 'node10',
    module: 'commonjs',
    customConditions: null,
  });

  const env: Record<string, string> = {
    TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions,
  };

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
  const useJestResolver = options.useJestResolver ?? !disableJestRuntime;

  // Jest defaults rootDir to the config file's directory, but allows overrides
  const rootDir = rawConfig.rootDir
    ? resolve(dirname(absConfigFilePath), rawConfig.rootDir)
    : resolve(context.workspaceRoot, projectRoot);

  const cache = (target.cache = true);
  const inputs = (target.inputs = await getInputs(
    namedInputs,
    rawConfig,
    rootDir,
    projectRoot,
    context.workspaceRoot,
    presetCache,
    needsDtsInputs,
    useJestResolver
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
        rootDir,
        context,
        presetCache
      );
      const targetGroup = [];
      const dependsOn: TargetConfiguration['dependsOn'] = [];
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
        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
          options: 'forward',
        });

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

      const jest = require(
        resolveJestPath(projectRoot, context.workspaceRoot)
      ) as typeof import('jest');
      const source = new jest.SearchSource(jestContext);

      const jestVersion = getJestMajorVersion()!;
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
        const dependsOn: TargetConfiguration['dependsOn'] = [];

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
          dependsOn.push({
            target: targetName,
            projects: 'self',
            params: 'forward',
            options: 'forward',
          });
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
  }

  return { targets, metadata };
}

async function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs'],
  rawConfig: any,
  rootDir: string,
  projectRoot: string,
  workspaceRoot: string,
  presetCache: Record<string, unknown>,
  needsDtsInputs: boolean,
  useJestResolver?: boolean
): Promise<TargetConfiguration['inputs']> {
  const inputs: TargetConfiguration['inputs'] = [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
  ];

  const externalDependencies = ['jest'];
  const resolvedModulePaths = rawConfig.modulePaths?.map((p: string) =>
    replaceRootDirInPath(rootDir, p)
  );

  const jestResolve = useJestResolver
    ? requireJestUtil<typeof import('jest-resolve')>(
        'jest-resolve',
        projectRoot,
        workspaceRoot
      ).default
    : null;

  const presetInput = jestResolve
    ? resolvePresetInputWithJestResolver(
        rawConfig.preset,
        rootDir,
        projectRoot,
        workspaceRoot,
        jestResolve,
        rawConfig.moduleDirectories,
        resolvedModulePaths
      )
    : resolvePresetInputWithoutJestResolver(
        rawConfig.preset,
        rootDir,
        projectRoot,
        workspaceRoot
      );

  // Track preset file path to avoid duplicating it with config-derived inputs
  let presetInputPath: string | null = null;
  if (presetInput) {
    if (
      typeof presetInput !== 'string' &&
      'externalDependencies' in presetInput
    ) {
      externalDependencies.push(...presetInput.externalDependencies);
    } else {
      presetInputPath = presetInput as string;
      inputs.push(presetInput);
    }
  }

  const resolveFilePath = jestResolve
    ? createJestResolveFilePathResolver(
        rootDir,
        projectRoot,
        workspaceRoot,
        jestResolve,
        rawConfig.moduleDirectories,
        resolvedModulePaths
      )
    : createFilePathResolverWithoutJest(rootDir, projectRoot, workspaceRoot);

  const configInputs = await getConfigFileInputs(
    rawConfig,
    rootDir,
    presetCache,
    resolveFilePath
  );

  for (const fileInput of configInputs.fileInputs) {
    if (fileInput !== presetInputPath) {
      inputs.push(fileInput);
    }
  }

  for (const dep of configInputs.externalDeps) {
    if (!externalDependencies.includes(dep)) {
      externalDependencies.push(dep);
    }
  }

  inputs.push({ externalDependencies });

  // When ts-jest runs without isolatedModules, it creates a TypeScript
  // Language Service that reads .d.ts files from dependency projects.
  // Declare these as dependentTasksOutputFiles so changes to dependency
  // type declarations correctly invalidate the test cache.
  if (needsDtsInputs) {
    inputs.push({
      dependentTasksOutputFiles: '**/*.d.ts',
      transitive: true,
    });
  }

  return inputs;
}

function resolvePresetInputWithoutJestResolver(
  presetValue: string | undefined,
  rootDir: string,
  projectRoot: string,
  workspaceRoot: string
): TargetConfiguration['inputs'][number] | null {
  if (!presetValue) return null;

  const presetPath = replaceRootDirInPath(rootDir, presetValue);
  const isNpmLike = !presetValue.startsWith('.') && !isAbsolute(presetPath);

  if (isNpmLike) {
    return { externalDependencies: [extractPackageName(presetValue)] };
  }

  const absoluteProjectRoot = resolve(workspaceRoot, projectRoot);
  return classifyResolvedPath(
    resolve(rootDir, presetPath),
    absoluteProjectRoot,
    workspaceRoot
  );
}

// preset resolution adapted from:
// https://github.com/jestjs/jest/blob/c54bccd657fb4cf060898717c09f633b4da3eec4/packages/jest-config/src/normalize.ts#L122
function resolvePresetInputWithJestResolver(
  presetValue: string | undefined,
  rootDir: string,
  projectRoot: string,
  workspaceRoot: string,
  jestResolve: typeof import('jest-resolve').default,
  moduleDirectories?: string[],
  modulePaths?: string[]
): TargetConfiguration['inputs'][number] | null {
  if (!presetValue) return null;

  let presetPath = replaceRootDirInPath(rootDir, presetValue);
  presetPath = presetPath.startsWith('.')
    ? presetPath
    : join(presetPath, 'jest-preset');
  const presetModule = jestResolve.findNodeModule(presetPath, {
    basedir: rootDir,
    extensions: ['.json', '.js', '.cjs', '.mjs'],
    moduleDirectory: moduleDirectories,
    paths: modulePaths,
  });

  if (!presetModule) {
    return null;
  }

  return classifyResolvedPath(
    presetModule,
    resolve(workspaceRoot, projectRoot),
    workspaceRoot
  );
}

// Adapted from here https://github.com/jestjs/jest/blob/c13bca3/packages/jest-config/src/utils.ts#L57-L69
function replaceRootDirInPath(rootDir: string, filePath: string): string {
  if (!filePath.startsWith('<rootDir>')) {
    return filePath;
  }
  return resolve(rootDir, normalize(`./${filePath.slice('<rootDir>'.length)}`));
}

type FilePathInput = string | { externalDependencies: string[] } | null;
type FilePathResolver = (filePath: string) => FilePathInput;

function classifyResolvedPath(
  absolutePath: string,
  absoluteProjectRoot: string,
  workspaceRoot: string
): FilePathInput {
  const relToWorkspace = normalizePath(relative(workspaceRoot, absolutePath));
  if (relToWorkspace.includes('node_modules/')) {
    const nmIndex = relToWorkspace.lastIndexOf('node_modules/');
    const afterNm = relToWorkspace.slice(nmIndex + 'node_modules/'.length);
    return { externalDependencies: [extractPackageName(afterNm)] };
  }
  const relToProject = normalizePath(
    relative(absoluteProjectRoot, absolutePath)
  );
  if (relToProject.startsWith('..')) {
    return joinPathFragments('{workspaceRoot}', relToWorkspace);
  }
  return joinPathFragments('{projectRoot}', relToProject);
}

function extractPackageName(value: string): string {
  const parts = value.split('/');
  return value.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function createFilePathResolverWithoutJest(
  rootDir: string,
  projectRoot: string,
  workspaceRoot: string
): FilePathResolver {
  const absoluteProjectRoot = resolve(workspaceRoot, projectRoot);
  return (filePath: string): FilePathInput => {
    const resolvedPath = replaceRootDirInPath(rootDir, filePath);

    if (looksLikePackageName(filePath, resolvedPath)) {
      return { externalDependencies: [extractPackageName(filePath)] };
    }

    return classifyResolvedPath(
      resolve(rootDir, resolvedPath),
      absoluteProjectRoot,
      workspaceRoot
    );
  };
}

function resolveWithPrefixFallback(
  filePath: string,
  prefix: string,
  resolver: FilePathResolver
): FilePathInput {
  if (
    !filePath.startsWith('.') &&
    !filePath.startsWith('<rootDir>') &&
    !isAbsolute(filePath) &&
    !filePath.startsWith(prefix)
  ) {
    const prefixed = resolver(`${prefix}${filePath}`);
    if (prefixed) return prefixed;
  }
  return resolver(filePath);
}

function looksLikePackageName(filePath: string, resolvedPath: string): boolean {
  return (
    !filePath.startsWith('.') &&
    !filePath.startsWith('<rootDir>') &&
    !isAbsolute(resolvedPath)
  );
}

function createJestResolveFilePathResolver(
  rootDir: string,
  projectRoot: string,
  workspaceRoot: string,
  jestResolve: typeof import('jest-resolve').default,
  moduleDirectories?: string[],
  modulePaths?: string[]
): FilePathResolver {
  const absoluteProjectRoot = resolve(workspaceRoot, projectRoot);
  const cache = new Map<string, FilePathInput>();
  return (filePath: string): FilePathInput => {
    if (cache.has(filePath)) {
      return cache.get(filePath);
    }

    const resolvedPath = replaceRootDirInPath(rootDir, filePath);
    let result: FilePathInput;
    const absolutePath = jestResolve.findNodeModule(resolvedPath, {
      basedir: rootDir,
      extensions: ['.js', '.json', '.cjs', '.mjs', '.mts', '.cts', '.node'],
      moduleDirectory: moduleDirectories,
      paths: modulePaths,
    });
    if (!absolutePath) {
      if (looksLikePackageName(filePath, resolvedPath)) {
        result = { externalDependencies: [extractPackageName(filePath)] };
      } else {
        result = null;
      }
    } else {
      result = classifyResolvedPath(
        absolutePath,
        absoluteProjectRoot,
        workspaceRoot
      );
    }

    cache.set(filePath, result);
    return result;
  };
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

  return require(
    require.resolve(packageName, {
      paths: [dirname(resolvedJestCorePaths[jestPath])],
    })
  );
}

async function getTestPaths(
  projectRoot: string,
  rawConfig: any,
  rootDir: string,
  context: CreateNodesContextV2,
  presetCache: Record<string, unknown>
): Promise<{ specs: string[]; testMatch: string[] }> {
  const testMatch = await getJestOption<string[]>(
    rawConfig,
    rootDir,
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
    rootDir,
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

/**
 * Collects workspace-relative paths to files whose CONTENT the plugin reads
 * when computing inferred targets and that live OUTSIDE the project root.
 *
 * Only two kinds of files qualify:
 *  - The jest preset (loaded to read its `transform`, etc.)
 *  - Tsconfig files in the extends chain referenced by ts-jest (read to
 *    determine `isolatedModules`); only walked when ts-jest is not already
 *    known to be in isolated mode.
 *
 * Other config references (setup files, custom resolvers, transformers,
 * etc.) are NOT collected — the plugin only resolves their paths and emits
 * them as task inputs; their content is not read by the plugin, so changes
 * to them don't influence inference.
 */
async function collectExternalFileReferences(
  rawConfig: any,
  absConfigFilePath: string,
  projectRoot: string,
  workspaceRoot: string,
  caches: {
    presetCache: Record<string, unknown>;
    tsconfigJsonCache: RawTsconfigJsonCache;
    tsconfigExistsCache: Map<string, boolean>;
    isolatedModulesCache: Map<string, IsolatedModulesResult>;
  }
): Promise<{ externalFiles: string[]; needsDtsInputs: boolean }> {
  const {
    presetCache,
    tsconfigJsonCache,
    tsconfigExistsCache,
    isolatedModulesCache,
  } = caches;
  const absWorkspaceRoot = resolve(workspaceRoot);
  const rootDir = rawConfig.rootDir
    ? resolve(dirname(absConfigFilePath), rawConfig.rootDir)
    : resolve(absWorkspaceRoot, projectRoot);
  const absoluteProjectRoot = resolve(absWorkspaceRoot, projectRoot);

  const externalFiles = new Set<string>();
  const addIfExternal = (absolutePath: string | null) => {
    if (!absolutePath) return;
    const rel = normalizePath(relative(absWorkspaceRoot, absolutePath));
    if (rel.startsWith('..') || isAbsolute(rel)) return; // outside workspace
    if (rel.includes('node_modules/')) return; // covered by lockfile
    const relToProject = normalizePath(
      relative(absoluteProjectRoot, absolutePath)
    );
    if (!relToProject.startsWith('..') && !isAbsolute(relToProject)) return; // inside project root
    externalFiles.add(rel);
  };

  // Preset path (content is loaded by the plugin to merge with rawConfig)
  if (typeof rawConfig.preset === 'string') {
    const replaced = replaceRootDirInPath(rootDir, rawConfig.preset);
    if (replaced.startsWith('.') || isAbsolute(replaced)) {
      addIfExternal(resolve(rootDir, replaced));
    }
  }

  // ts-jest tsconfig extends chain — only walked when ts-jest is in
  // non-isolated mode (otherwise the chain doesn't influence the output).
  // Loading the preset is required to merge its transform with the raw
  // config, since presets are the common source of ts-jest configuration.
  const presetConfig = await loadPresetConfig(rawConfig, rootDir, presetCache);
  const transform: Record<string, string | [string, unknown]> = {
    ...(presetConfig?.transform ?? {}),
    ...(rawConfig.transform ?? {}),
  };
  let needsDtsInputs = false;
  for (const value of Object.values(transform)) {
    let transformPath: string;
    let transformOptions: Record<string, any> | undefined;
    if (Array.isArray(value)) {
      transformPath = value[0];
      transformOptions = value[1] as Record<string, any>;
    } else if (typeof value === 'string') {
      transformPath = value;
    } else {
      continue;
    }
    if (!isTsJestTransformer(transformPath)) continue;
    if (transformOptions?.isolatedModules === true) {
      const tsJestMajor = getTsJestMajorVersion();
      if (tsJestMajor !== null && tsJestMajor < 30) continue;
    }
    const tsconfigAbsPath = transformOptions?.tsconfig
      ? resolve(
          rootDir,
          replaceRootDirInPath(rootDir, transformOptions.tsconfig)
        )
      : findNearestTsconfig(rootDir, absWorkspaceRoot, tsconfigExistsCache);
    if (!tsconfigAbsPath) {
      // No tsconfig found — ts-jest defaults to non-isolated mode
      needsDtsInputs = true;
      continue;
    }
    const { value: isolatedValue, visitedFiles } = resolveIsolatedModules(
      tsconfigAbsPath,
      tsconfigJsonCache,
      isolatedModulesCache
    );
    for (const visitedFile of visitedFiles) {
      addIfExternal(visitedFile);
    }
    if (isolatedValue !== true) needsDtsInputs = true;
  }

  return { externalFiles: [...externalFiles], needsDtsInputs };
}

async function loadPresetConfig(
  rawConfig: any,
  rootDir: string,
  presetCache: Record<string, unknown>
): Promise<Record<string, any> | null> {
  if (!rawConfig.preset) return null;

  const presetValue = replaceRootDirInPath(rootDir, rawConfig.preset);
  let presetPath: string;
  if (presetValue.startsWith('.') || isAbsolute(presetValue)) {
    presetPath = resolve(rootDir, presetValue);
  } else {
    try {
      presetPath = require.resolve(join(presetValue, 'jest-preset'), {
        paths: [rootDir],
      });
    } catch {
      return null;
    }
  }
  try {
    if (!presetCache[presetPath]) {
      presetCache[presetPath] = loadConfigFile(presetPath);
    }
    return (await presetCache[presetPath]) as Record<string, any>;
  } catch {
    // If preset fails to load, ignore the error and continue.
    // This is safe and less jarring for users. They will need to fix the
    // preset for Jest to run, and at that point we can read in the correct
    // value.
    return null;
  }
}

async function getConfigFileInputs(
  rawConfig: any,
  rootDir: string,
  presetCache: Record<string, unknown>,
  resolveFilePath: FilePathResolver
): Promise<{ fileInputs: string[]; externalDeps: string[] }> {
  const fileInputs = new Set<string>();
  const externalDeps = new Set<string>();
  const preset = await loadPresetConfig(rawConfig, rootDir, presetCache);

  function addInput(input: FilePathInput) {
    if (!input) return;
    if (typeof input === 'string') {
      fileInputs.add(input);
    } else {
      input.externalDependencies.forEach((d) => externalDeps.add(d));
    }
  }

  // Replaced properties: rawConfig[prop] wins over preset[prop]
  for (const prop of [
    'resolver',
    'globalSetup',
    'globalTeardown',
    'snapshotResolver',
    'testResultsProcessor',
  ] as const) {
    const value = rawConfig[prop] ?? preset?.[prop];
    if (typeof value === 'string') {
      addInput(resolveFilePath(value));
    }
  }

  // runner uses jest-runner- prefix resolution
  const runner = rawConfig.runner ?? preset?.runner;
  if (typeof runner === 'string') {
    addInput(
      resolveWithPrefixFallback(runner, 'jest-runner-', resolveFilePath)
    );
  }

  // Concatenated properties: preset values + config values
  for (const prop of ['setupFiles', 'setupFilesAfterEnv'] as const) {
    const values = [
      ...((preset?.[prop] as string[]) ?? []),
      ...((rawConfig[prop] as string[]) ?? []),
    ];
    for (const value of values) {
      if (typeof value === 'string') {
        addInput(resolveFilePath(value));
      }
    }
  }

  // Merged: moduleNameMapper — config keys win (skip values with backreferences like $1)
  const moduleNameMapper: Record<string, string | string[]> = {
    ...(preset?.moduleNameMapper ?? {}),
    ...(rawConfig.moduleNameMapper ?? {}),
  };
  for (const value of Object.values(moduleNameMapper)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (typeof v !== 'string') continue;
      if (/\$\d/.test(v)) continue;
      addInput(resolveFilePath(v));
    }
  }

  // Merged: transform — config keys win
  const transform: Record<string, string | [string, unknown]> = {
    ...(preset?.transform ?? {}),
    ...(rawConfig.transform ?? {}),
  };
  for (const value of Object.values(transform)) {
    let transformPath: string;
    if (Array.isArray(value)) {
      transformPath = value[0];
    } else if (typeof value === 'string') {
      transformPath = value;
    } else {
      continue;
    }
    addInput(resolveFilePath(transformPath));
  }

  // Replaced: snapshotSerializers, reporters, watchPlugins
  const snapshotSerializers: string[] =
    (rawConfig.snapshotSerializers as string[]) ??
    (preset?.snapshotSerializers as string[]) ??
    [];
  for (const value of snapshotSerializers) {
    if (typeof value === 'string') {
      addInput(resolveFilePath(value));
    }
  }

  const reporters: (string | [string, unknown])[] =
    rawConfig.reporters ?? preset?.reporters ?? [];
  for (const entry of reporters) {
    const name = Array.isArray(entry) ? entry[0] : entry;
    if (typeof name !== 'string') continue;
    if (REPORTER_BUILTINS.has(name)) continue;
    addInput(resolveFilePath(name));
  }

  // watchPlugins uses jest-watch- prefix resolution
  const watchPlugins: (string | [string, unknown])[] =
    rawConfig.watchPlugins ?? preset?.watchPlugins ?? [];
  for (const entry of watchPlugins) {
    const name = Array.isArray(entry) ? entry[0] : entry;
    if (typeof name !== 'string') continue;
    addInput(resolveWithPrefixFallback(name, 'jest-watch-', resolveFilePath));
  }

  return {
    fileInputs: [...fileInputs],
    externalDeps: [...externalDeps],
  };
}

/**
 * Walks up from `startDir` looking for `tsconfig.json`, stopping at
 * `stopDir` (inclusive). Mirrors `ts.findConfigFile` but capped at the
 * workspace root to avoid escaping the monorepo.
 */
function findNearestTsconfig(
  startDir: string,
  stopDir: string,
  existsCache: Map<string, boolean>
): string | null {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, 'tsconfig.json');
    let exists = existsCache.get(candidate);
    if (exists === undefined) {
      exists = existsSync(candidate);
      existsCache.set(candidate, exists);
    }
    if (exists) return candidate;
    if (dir === stopDir) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function isTsJestTransformer(value: string): boolean {
  if (value === 'ts-jest' || value.startsWith('ts-jest/')) {
    return true;
  }

  // Handle resolved paths (e.g. from require.resolve('ts-jest') in configs)
  const normalized = normalizePath(value);
  return (
    normalized.includes('/node_modules/ts-jest/') ||
    normalized.endsWith('/node_modules/ts-jest')
  );
}

/**
 * Returns the effective `compilerOptions.isolatedModules` for a tsconfig,
 * walking the `extends` chain via `walkTsconfigExtendsChain`. Tri-state:
 * `value` is `undefined` when the option is not set anywhere in the chain.
 */
function resolveIsolatedModules(
  tsconfigPath: string,
  jsonCache: RawTsconfigJsonCache,
  resultCache: Map<string, IsolatedModulesResult>
): IsolatedModulesResult {
  const cached = resultCache.get(tsconfigPath);
  if (cached) return cached;

  let value: boolean | undefined;
  const visitedFiles = new Set<string>();

  walkTsconfigExtendsChain(
    tsconfigPath,
    (absPath, rawJson) => {
      visitedFiles.add(absPath);
      const opts = (rawJson as any)?.compilerOptions;
      if (opts?.isolatedModules !== undefined) {
        value = opts.isolatedModules === true;
        return 'stop';
      }
      // verbatimModuleSyntax: true implies isolatedModules: true (TS 5.0+,
      // the minimum TS version Nx supports)
      if (opts?.verbatimModuleSyntax === true) {
        value = true;
        return 'stop';
      }
      return 'continue';
    },
    { jsonCache }
  );

  const result: IsolatedModulesResult = { value, visitedFiles };
  resultCache.set(tsconfigPath, result);
  return result;
}

// Module-level memoization: package versions don't change during a process
// lifetime, so it's safe to cache across createNodes invocations.
let cachedJestMajorVersion: number | null | undefined;
function getJestMajorVersion(): number | null {
  if (cachedJestMajorVersion === undefined) {
    cachedJestMajorVersion = getInstalledJestMajorVersion();
  }
  return cachedJestMajorVersion;
}

let cachedTsJestMajorVersion: number | null | undefined;
function getTsJestMajorVersion(): number | null {
  if (cachedTsJestMajorVersion !== undefined) {
    return cachedTsJestMajorVersion;
  }
  try {
    const { major } = require('semver');
    const version = require('ts-jest/package.json').version as string;
    cachedTsJestMajorVersion = major(version) as number;
  } catch {
    cachedTsJestMajorVersion = null;
  }
  return cachedTsJestMajorVersion;
}

async function getJestOption<T = any>(
  rawConfig: any,
  rootDir: string,
  optionName: string,
  presetCache: Record<string, unknown>
): Promise<T> {
  if (rawConfig[optionName]) return rawConfig[optionName];

  const preset = await loadPresetConfig(rawConfig, rootDir, presetCache);
  if (preset?.[optionName]) return preset[optionName];

  return undefined;
}
