import {
  calculateHashesForCreateNodes,
  getNamedInputs,
  PluginCache,
} from '@nx/devkit/internal';
import {
  CreateDependencies,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigFileName } from '@nx/js';
import {
  walkTsconfigExtendsChain,
  type RawTsconfigJsonCache,
} from '@nx/js/src/internal';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { deriveGroupNameFromTarget } from 'nx/src/utils/plugins';
import { loadViteDynamicImport } from '../utils/executor-utils';

export interface VitestPluginOptions {
  testTargetName?: string;
  /**
   * Atomizer for vitest
   */
  ciTargetName?: string;
  /**
   * The name that should be used to group atomized tasks on CI
   */
  ciGroupName?: string;
  /**
   * Default mode for running tests.
   * - 'watch': Tests run in watch mode locally, auto-run in CI (default)
   * - 'run': Tests run once and exit
   */
  testMode?: 'watch' | 'run';
}

type VitestTargets = Pick<
  ProjectConfiguration,
  'targets' | 'metadata' | 'projectType'
>;

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const vitestConfigGlob = '**/{vite,vitest}.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodes: CreateNodesV2<VitestPluginOptions> = [
  vitestConfigGlob,
  async (configFilePaths, options, context) => {
    const pmc = getPackageManagerCommand(
      detectPackageManager(context.workspaceRoot)
    );
    const optionsHash = hashObject(options);
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(
      workspaceDataDirectory,
      `vitest-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<VitestTargets>(cachePath);

    const { roots: projectRoots, configFiles: validConfigFiles } =
      configFilePaths.reduce(
        (acc, configFile) => {
          const potentialRoot = dirname(configFile);
          if (checkIfConfigFileShouldBeProject(potentialRoot, context)) {
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

    const lockfile = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const tsconfigChainsByProjectRoot = collectTsconfigInputsByProjectRoot(
      projectRoots,
      context.workspaceRoot
    );
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      normalizedOptions,
      context,
      projectRoots.map((root) => [
        lockfile,
        ...(tsconfigChainsByProjectRoot.get(root) ?? []),
      ])
    );

    try {
      return await createNodesFromFiles(
        async (configFile, _, context, idx) => {
          const projectRoot = dirname(configFile);

          // results from vitest.config.js will be different from results of vite.config.js
          // but the hash will be the same because it is based on the files under the project root.
          // Adding the config file path to the hash ensures that the final hash value is different
          // for different config files.
          const hash = hashes[idx] + configFile;
          if (!targetsCache.has(hash)) {
            targetsCache.set(
              hash,
              await buildVitestTargets(
                configFile,
                projectRoot,
                normalizedOptions,
                context,
                pmc,
                tsconfigChainsByProjectRoot.get(projectRoot) ?? []
              )
            );
          }
          const { projectType, metadata, targets } = targetsCache.get(hash);

          const project: ProjectConfiguration = {
            root: projectRoot,
            targets,
            metadata,
            projectType,
          };

          return {
            projects: {
              [projectRoot]: project,
            },
          };
        },
        validConfigFiles,
        options,
        context
      );
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function buildVitestTargets(
  configFilePath: string,
  projectRoot: string,
  options: VitestPluginOptions,
  context: CreateNodesContextV2,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  tsconfigInputs: string[]
): Promise<VitestTargets> {
  const absoluteConfigFilePath = joinPathFragments(
    context.workspaceRoot,
    configFilePath
  );

  // Workaround for the `build$3 is not a function` error that we sometimes see in agents.
  // This should be removed later once we address the issue properly
  try {
    const importEsbuild = () => new Function('return import("esbuild")')();
    await importEsbuild();
  } catch {
    // do nothing
  }

  // Workaround for race condition with ESM-only Vite plugins (e.g. @vitejs/plugin-vue@6+)
  // If vite.config.ts is compiled as CJS, then when both require('@vitejs/plugin-vue') and import('@vitejs/plugin-vue')
  // are pending in the same process, Node will throw an error:
  // Error [ERR_INTERNAL_ASSERTION]: Cannot require() ES Module @vitejs/plugin-vue/dist/index.js because it is not yet fully loaded.
  // This may be caused by a race condition if the module is simultaneously dynamically import()-ed via Promise.all().
  try {
    const importVuePlugin = () =>
      new Function('return import("@vitejs/plugin-vue")')();
    await importVuePlugin();
  } catch {
    // Plugin not installed or not needed, ignore
  }

  // Workaround for race condition with vitest/node on Node 24+
  // When multiple vitest.config files are processed in parallel, Node can throw:
  // Error [ERR_INTERNAL_ASSERTION]: Cannot require() ES Module vitest/dist/node.js
  // because it is not yet fully loaded.
  // See: https://github.com/nrwl/nx/issues/34028
  try {
    const importVitestNode = () =>
      new Function('return import("vitest/node")')();
    await importVitestNode();
  } catch {
    // vitest/node not available or not needed, ignore
  }

  const { resolveConfig } = await loadViteDynamicImport();
  const viteBuildConfig = await resolveConfig(
    {
      configFile: absoluteConfigFilePath,
      mode: 'development',
    },
    'build'
  );

  // If this is a root workspace config file with projects property, don't infer targets.
  // The root config is just an orchestrator - the actual tests live in the individual project configs.
  const isWorkspaceRoot = projectRoot === '.';
  // TODO(jack): Remove this cast when @nx/vitest switches to moduleResolution:
  // "nodenext". Vite 8's rolldown types break vitest's test augmentation.
  const hasProjectsProperty = Array.isArray(
    (viteBuildConfig as any)?.test?.projects
  );
  if (isWorkspaceRoot && hasProjectsProperty) {
    return { targets: {}, metadata: {}, projectType: 'library' };
  }

  let metadata: ProjectConfiguration['metadata'] = {};

  const { testOutputs, hasTest } = getOutputs(
    viteBuildConfig,
    projectRoot,
    context.workspaceRoot
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  // if file is vitest.config or vite.config has definition for test, create targets for test and/or atomized tests
  if (configFilePath.includes('vitest.config') || hasTest) {
    const isTypecheckEnabled = !!(viteBuildConfig as any)?.test?.typecheck
      ?.enabled;
    targets[options.testTargetName] = await testTarget(
      namedInputs,
      testOutputs,
      projectRoot,
      options.testMode,
      pmc,
      isTypecheckEnabled,
      tsconfigInputs
    );

    if (options.ciTargetName) {
      const groupName =
        options.ciGroupName ?? deriveGroupNameFromTarget(options.ciTargetName);
      const targetGroup = [];
      const dependsOn: string[] = [];
      metadata = {
        targetGroups: {
          [groupName]: targetGroup,
        },
      };

      const projectRootRelativeTestPaths =
        await getTestPathsRelativeToProjectRoot(
          projectRoot,
          context.workspaceRoot
        );

      for (const relativePath of projectRootRelativeTestPaths) {
        if (relativePath.includes('../')) {
          throw new Error(
            '@nx/vitest attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
              `\n\n${JSON.stringify(
                {
                  projectRoot,
                  relativePath,
                  projectRootRelativeTestPaths,
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
          // It does not make sense to run atomized tests in watch mode as they are intended to be run in CI
          command: `vitest run ${relativePath}`,
          cache: targets[options.testTargetName].cache,
          inputs: targets[options.testTargetName].inputs,
          outputs: targets[options.testTargetName].outputs,
          options: {
            cwd: projectRoot,
            env: targets[options.testTargetName].options.env,
          },
          metadata: {
            technologies: ['vitest'],
            description: `Run Vitest Tests in ${relativePath}`,
            help: {
              command: `${pmc.exec} vitest --help`,
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
          inputs: targets[options.testTargetName].inputs,
          outputs: targets[options.testTargetName].outputs,
          dependsOn,
          metadata: {
            technologies: ['vitest'],
            description: 'Run Vitest Tests in CI',
            nonAtomizedTarget: options.testTargetName,
            help: {
              command: `${pmc.exec} vitest --help`,
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

  return { targets, metadata, projectType: 'library' };
}

async function testTarget(
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string,
  testMode: 'watch' | 'run' = 'watch',
  pmc: ReturnType<typeof getPackageManagerCommand>,
  isTypecheckEnabled: boolean,
  tsconfigInputs: string[]
) {
  const command = testMode === 'run' ? 'vitest run' : 'vitest';
  const depOutputsGlob = isTypecheckEnabled ? '**/*.{js,d.ts}' : '**/*.js';
  return {
    command,
    options: { cwd: joinPathFragments(projectRoot) },
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      ...tsconfigInputs.map((f) => ({
        json: `{workspaceRoot}/${f}`,
        fields: ['compilerOptions'],
      })),
      {
        externalDependencies: ['vitest'],
      },
      { env: 'CI' },
      { dependentTasksOutputFiles: depOutputsGlob, transitive: true },
    ],
    outputs,
    metadata: {
      technologies: ['vitest'],
      description: `Run Vitest tests`,
      help: {
        command: `${pmc.exec} vitest --help`,
        example: {
          options: {
            bail: 1,
            coverage: true,
          },
        },
      },
    },
  };
}

function getOutputs(
  viteBuildConfig: Record<string, any> | undefined,
  projectRoot: string,
  workspaceRoot: string
): {
  testOutputs: string[];
  hasTest: boolean;
} {
  const { test } = viteBuildConfig;

  const reportsDirectoryPath = normalizeOutputPath(
    test?.coverage?.reportsDirectory,
    projectRoot,
    workspaceRoot,
    'coverage'
  );

  return {
    testOutputs: [reportsDirectoryPath],
    hasTest: !!test,
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string,
  workspaceRoot: string,
  path: 'coverage'
): string | undefined {
  if (!outputPath) {
    if (projectRoot === '.') {
      return `{projectRoot}/${path}`;
    } else {
      return `{workspaceRoot}/${path}/{projectRoot}`;
    }
  } else {
    if (isAbsolute(outputPath)) {
      return `{workspaceRoot}/${relative(workspaceRoot, outputPath)}`;
    } else {
      if (outputPath.startsWith('..')) {
        return joinPathFragments('{workspaceRoot}', projectRoot, outputPath);
      } else {
        return joinPathFragments('{projectRoot}', outputPath);
      }
    }
  }
}

function normalizeOptions(options: VitestPluginOptions): VitestPluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  options.testMode ??= 'watch';
  return options;
}

/**
 * Collects tsconfig files that Vite's esbuild-based config bundler reads
 * but are outside the project root (and thus not covered by `default`).
 *
 * Vite < 8 uses esbuild's Build API to bundle config files. esbuild walks
 * UP from the entry point, reading and parsing every `tsconfig.json` in
 * every ancestor directory plus their `extends` chains. Vite >= 8 uses
 * rolldown with `tsconfig: false`, but pnpm can resolve different Vite
 * versions per project, so we always collect — the walk is cheap (cached
 * JSON reads) and over-declaring inputs for Vite 8 projects is harmless.
 *
 * Files already handled elsewhere are excluded:
 * - Inside the project root → covered by `default` (`{projectRoot}/**\/*`)
 * - The root tsconfig (tsconfig.base.json or tsconfig.json) → covered by
 *   the native TsConfiguration hash instruction
 * - Inside node_modules → invalidated via lockfile
 * - Outside the workspace → cannot be expressed as inputs
 */
function collectTsconfigInputsByProjectRoot(
  projectRoots: string[],
  workspaceRoot: string
): Map<string, string[]> {
  const jsonCache: RawTsconfigJsonCache = new Map();
  const result = new Map<string, string[]>();

  const rootTsConfigName = getRootTsConfigFileName();

  for (const projectRoot of projectRoots) {
    if (projectRoot === '.') continue;

    const outside: string[] = [];
    const seen = new Set<string>();
    const projectPrefix = `${projectRoot}/`;

    const collect = (absolutePath: string) => {
      const wsRelative = relative(workspaceRoot, absolutePath)
        .split(sep)
        .join('/');
      if (seen.has(wsRelative)) return;
      seen.add(wsRelative);
      if (wsRelative.startsWith('../') || wsRelative === '..') return;
      if (
        wsRelative.startsWith('node_modules/') ||
        wsRelative.includes('/node_modules/')
      )
        return;
      if (wsRelative === projectRoot || wsRelative.startsWith(projectPrefix))
        return;
      if (wsRelative === rootTsConfigName) return;
      outside.push(wsRelative);
    };

    // 1. Walk the project tsconfig's extends chain
    const projectTsconfig = join(workspaceRoot, projectRoot, 'tsconfig.json');
    if (existsSync(projectTsconfig)) {
      walkTsconfigExtendsChain(
        projectTsconfig,
        (absPath) => {
          collect(absPath);
          return 'continue';
        },
        { jsonCache }
      );
    }

    // 2. Walk UP ancestor directories (esbuild reads every tsconfig.json
    //    between the entry point and the filesystem root)
    let dir = dirname(projectRoot);
    while (dir && dir !== '.') {
      const ancestorTsconfig = join(workspaceRoot, dir, 'tsconfig.json');
      if (existsSync(ancestorTsconfig)) {
        walkTsconfigExtendsChain(
          ancestorTsconfig,
          (absPath) => {
            collect(absPath);
            return 'continue';
          },
          { jsonCache }
        );
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // 3. Check the workspace root itself (dirname loop above stops at '.')
    const rootTsconfig = join(workspaceRoot, 'tsconfig.json');
    if (existsSync(rootTsconfig)) {
      walkTsconfigExtendsChain(
        rootTsconfig,
        (absPath) => {
          collect(absPath);
          return 'continue';
        },
        { jsonCache }
      );
    }

    if (outside.length > 0) {
      result.set(projectRoot, outside);
    }
  }

  return result;
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContextV2
): boolean {
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return false;
  }

  return true;
}

async function getTestPathsRelativeToProjectRoot(
  projectRoot: string,
  workspaceRoot: string
): Promise<string[]> {
  const fullProjectRoot = join(workspaceRoot, projectRoot);
  const { createVitest } = await import('vitest/node');
  const vitest = await createVitest('test', {
    root: fullProjectRoot,
    dir: fullProjectRoot,
    filesOnly: true,
    watch: false,
  });
  const relevantTestSpecifications =
    await vitest.getRelevantTestSpecifications();
  // Sort to keep atomized target name insertion order stable.
  // vitest.getRelevantTestSpecifications uses tinyglobby internally,
  // which does not sort its filesystem traversal output.
  return relevantTestSpecifications
    .filter((ts) =>
      fullProjectRoot === '.' ? true : ts.moduleId.startsWith(fullProjectRoot)
    )
    .map((ts) => normalizePath(relative(projectRoot, ts.moduleId)))
    .sort();
}
