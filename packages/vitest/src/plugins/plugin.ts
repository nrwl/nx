import {
  calculateHashesForCreateNodes,
  getNamedInputs,
  PluginCache,
} from '@nx/devkit/internal';
import {
  CreateDependencies,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodes,
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
} from '@nx/js/internal';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import type { InlineConfig } from 'vitest/node';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { deriveGroupNameFromTarget } from 'nx/src/utils/plugins';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import {
  loadViteDynamicImport,
  loadVitestConfigDynamicImport,
} from '../utils/executor-utils';

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
  /**
   * How atomized test files (the `ciTargetName` targets) are discovered.
   * - 'glob' (default): enumerate specs with a glob that mirrors Vitest's own
   *   resolution instead of booting Vitest per project. Booting Vitest starts a
   *   Vite dev server and runs the config's plugin hooks, so the glob is faster
   *   during graph creation.
   * - 'vitest': always enumerate through Vitest.
   *
   * Configs a glob cannot reproduce faithfully still boot Vitest automatically
   * even under 'glob': `test.projects`/`test.workspace` (inline or an
   * auto-loaded `vitest.workspace.*`/`vitest.projects.*` sibling file), plugins
   * with a `configureVitest` hook, `test.changed`/`test.related`, and enabled
   * browser `instances` that set their own include/exclude/includeSource/dir.
   * @default 'glob'
   */
  discoverTestFiles?: 'glob' | 'vitest';
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

export const createNodes: CreateNodes<VitestPluginOptions> = [
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
    const targetsCache = new PluginCache<VitestTargets | null>(cachePath);

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
            const result = await buildVitestTargets(
              configFile,
              projectRoot,
              normalizedOptions,
              context,
              pmc,
              tsconfigChainsByProjectRoot.get(projectRoot) ?? []
            );
            // Cache the result even when it's null (a root orchestrator config)
            // so the config isn't re-resolved on every project-graph build.
            targetsCache.set(hash, result);
          }
          const cached = targetsCache.get(hash);
          // `buildVitestTargets` returns null for a root orchestrator config
          // that must not become a project; register no node for it.
          if (!cached) {
            return { projects: {} };
          }
          const { projectType, metadata, targets } = cached;

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
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  tsconfigInputs: string[]
): Promise<VitestTargets | null> {
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

  // A root config that aggregates project configs via `test.projects` is just an
  // orchestrator; the actual tests live in the individual project configs. Skip it
  // entirely so it does not register a project rooted at the workspace root (which
  // would, for example, make `nx format` treat the whole workspace as one project).
  const isWorkspaceRoot = projectRoot === '.';
  const hasProjectsProperty = Array.isArray(viteBuildConfig.test?.projects);
  if (isWorkspaceRoot && hasProjectsProperty) {
    return null;
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
    const isTypecheckEnabled = !!viteBuildConfig.test?.typecheck?.enabled;
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

      // Not normalizing in normalizeOptions since it also affects the options
      // computed for convert-to-inferred.
      const useGlobDiscovery =
        (options.discoverTestFiles ?? 'glob') !== 'vitest';
      // Glob discovery reads the serve-resolved config: Vitest runs tests
      // through a Vite server (the `serve` command), so `apply: 'serve'`
      // plugins and command-sensitive `test` include/exclude are absent from
      // the build resolution used above for outputs. Resolve under `mode:
      // 'test'` to match Vitest, which defaults the Vite mode to 'test'; a
      // config that branches include/exclude on `mode` would otherwise enumerate
      // a different spec set here than at test time. The runtime path resolves
      // its own config, so only resolve here when the glob path may run.
      const viteServeConfig = useGlobDiscovery
        ? await resolveConfig(
            {
              configFile: absoluteConfigFilePath,
              mode: 'test',
            },
            'serve'
          )
        : undefined;
      const projectRootRelativeTestPaths =
        await getTestPathsRelativeToProjectRoot(
          projectRoot,
          context.workspaceRoot,
          viteServeConfig
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
      // Vitest runs on Vite, which transforms a dependency's sources and
      // resolves their TypeScript project references. When a dependency's root
      // tsconfig references its tsconfig.spec.json / tsconfig.storybook.json,
      // those files are read during resolution, yet the `production` named
      // input excludes them (so `^production` does not cover them). When
      // `production` is in use, declare them explicitly so the dependency's
      // spec/storybook tsconfigs are tracked as inputs.
      ...('production' in namedInputs
        ? [
            'default',
            '^production',
            {
              fileset: '{projectRoot}/tsconfig.spec.json',
              dependencies: true as const,
            },
            {
              fileset: '{projectRoot}/tsconfig.storybook.json',
              dependencies: true as const,
            },
          ]
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
  context: CreateNodesContext
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
  workspaceRoot: string,
  viteConfig: Record<string, any> | undefined
): Promise<string[]> {
  const fullProjectRoot = join(workspaceRoot, projectRoot);

  // `viteConfig` is resolved only when glob discovery is requested; its absence
  // means the runtime path was selected (`discoverTestFiles: 'vitest'`).
  if (viteConfig) {
    const test: InlineConfig = viteConfig.test ?? {};
    if (!configRequiresVitestRuntime(test, viteConfig, fullProjectRoot)) {
      return globTestPathsRelativeToProjectRoot(
        test,
        workspaceRoot,
        projectRoot
      );
    }
  }

  return getTestPathsViaVitestRuntime(fullProjectRoot, projectRoot);
}

/**
 * Enumerates a project's test files by mirroring Vitest's own resolution with
 * a glob. Vitest globs `test.include` and `test.includeSource` (both skipped
 * when typecheck is enabled with `only`, the latter also kept only when the
 * file contains an in-source test) plus `test.typecheck.include` (when
 * typecheck is enabled), each minus the relevant `exclude`, from the project
 * root. Defaults come from the installed Vitest so they track the user's
 * version. Globbing goes through the Nx workspace context (the daemon-cached
 * file index), so files ignored by `.gitignore`/`.nxignore` are never
 * candidates. Callers must first confirm the config is reproducible with a
 * glob via `configRequiresVitestRuntime`.
 */
async function globTestPathsRelativeToProjectRoot(
  test: InlineConfig,
  workspaceRoot: string,
  projectRoot: string
): Promise<string[]> {
  const { configDefaults } = await loadVitestConfigDynamicImport();

  const exclude: string[] = test.exclude ?? configDefaults.exclude;
  const typecheck = test.typecheck;
  const typecheckOnly = !!(typecheck?.enabled && typecheck?.only);
  // The workspace context matches workspace-relative paths, while the config's
  // patterns are relative to the project root; anchor them to it.
  const globProjectFiles = (include: string[], ignore: string[]) =>
    globWithWorkspaceContext(
      workspaceRoot,
      include.map((pattern) => joinPathFragments(projectRoot, pattern)),
      ignore.map((pattern) => joinPathFragments(projectRoot, pattern))
    );

  // Regular and type tests are independent walks; run them together.
  const globJobs: Promise<string[]>[] = [];

  // Typecheck enabled with `only` makes Vitest run only type tests, so skip
  // regular tests.
  if (!typecheckOnly) {
    const include: string[] = test.include ?? configDefaults.include;
    globJobs.push(globProjectFiles(include, exclude));
  }

  if (typecheck?.enabled) {
    const include: string[] =
      typecheck.include ?? configDefaults.typecheck.include;
    const ignore: string[] =
      typecheck.exclude ?? configDefaults.typecheck.exclude;
    globJobs.push(globProjectFiles(include, ignore));
  }

  const matches = new Set<string>();
  for (const files of await Promise.all(globJobs)) {
    for (const file of files) matches.add(file);
  }

  // In-source tests: only files that actually contain a test are included.
  // Typecheck enabled with `only` makes Vitest run only type tests, so skip
  // these too.
  if (!typecheckOnly && test.includeSource?.length) {
    const sourceFiles = await globProjectFiles(test.includeSource, exclude);
    // The candidate set can be the whole `src` tree, so read in bounded
    // batches; an unbounded Promise.all over every file risks EMFILE.
    const readConcurrency = 25;
    for (let i = 0; i < sourceFiles.length; i += readConcurrency) {
      const inSourceMatches = await Promise.all(
        sourceFiles.slice(i, i + readConcurrency).map(async (file) => {
          // Vitest tolerates unreadable in-source candidates and skips them;
          // match that so a permission error or TOCTOU race can't abort graph
          // creation.
          try {
            const content = await readFile(join(workspaceRoot, file), 'utf-8');
            return content.includes('import.meta.vitest') ? file : null;
          } catch {
            return null;
          }
        })
      );
      for (const file of inSourceMatches) {
        if (file) matches.add(file);
      }
    }
  }

  // The workspace context returns workspace-relative paths; keep only files
  // under the project root (matching the runtime path, which filters to files
  // under the root) and re-relativize them to it.
  const projectPrefix =
    projectRoot === '.' ? '' : `${normalizePath(projectRoot)}/`;
  return [...matches]
    .filter(
      (file) =>
        !file.startsWith('..') &&
        !isAbsolute(file) &&
        file.startsWith(projectPrefix)
    )
    .map((file) => normalizePath(file.slice(projectPrefix.length)))
    .sort();
}

// Sibling files Vitest 3 auto-loads to define sub-projects even when the config
// object declares none. Removed in Vitest 4 in favor of inline `test.projects`.
const vitestWorkspaceFiles = ['vitest.workspace', 'vitest.projects'].flatMap(
  (name) =>
    ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json'].map(
      (ext) => `${name}.${ext}`
    )
);

/**
 * Whether a config's test discovery cannot be faithfully reproduced with a
 * glob, so enumeration must go through Vitest itself.
 */
function configRequiresVitestRuntime(
  test: Record<string, any>,
  viteConfig: Record<string, any>,
  projectDir: string
): boolean {
  // Multi-project configs resolve include/exclude per sub-project.
  if (Array.isArray(test?.projects) || test?.workspace) return true;
  // Vitest 3 auto-loads a `vitest.workspace.*`/`vitest.projects.*` sibling file
  // to define sub-projects even when the config object declares none; the glob
  // resolves only the single config, so it cannot reproduce that.
  if (vitestWorkspaceFiles.some((file) => existsSync(join(projectDir, file)))) {
    return true;
  }
  // Vitest filters specs by VCS/graph state, which a glob cannot know.
  if (test?.changed || test?.related) return true;
  // Browser mode: an instance can override include/exclude/includeSource, and
  // `dir` (the base directory Vitest scans), so a top-level glob enumerates a
  // different spec set than the instance would. Vitest ignores `instances`
  // while browser mode is off, and the atomized target runs `vitest run <file>`
  // without a browser flag, so the resolved `enabled` matches the run.
  const browserInstances: any[] = test?.browser?.instances ?? [];
  if (
    test?.browser?.enabled &&
    browserInstances.some(
      (instance) =>
        instance &&
        (instance.include?.length ||
          instance.exclude?.length ||
          instance.includeSource?.length ||
          instance.dir)
    )
  ) {
    return true;
  }
  // A plugin can inject or reshape projects through this Vitest-only hook.
  const plugins: unknown[] = viteConfig?.plugins ?? [];
  return plugins.some(
    (plugin) =>
      plugin && typeof plugin === 'object' && 'configureVitest' in plugin
  );
}

async function getTestPathsViaVitestRuntime(
  fullProjectRoot: string,
  projectRoot: string
): Promise<string[]> {
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
