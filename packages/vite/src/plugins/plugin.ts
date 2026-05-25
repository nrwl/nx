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
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigFileName } from '@nx/js';
import {
  walkTsconfigExtendsChain,
  type RawTsconfigJsonCache,
  addBuildAndWatchDepsTargets,
  isUsingTsSolutionSetup as _isUsingTsSolutionSetup,
} from '@nx/js/internal';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { loadViteDynamicImport } from '../utils/executor-utils';
import picomatch = require('picomatch');
import type { ResolvedConfig } from 'vite';

export interface VitePluginOptions {
  buildTargetName?: string;
  /**
   * @deprecated Use devTargetName instead. This option will be removed in Nx 22.
   */
  serveTargetName?: string;
  devTargetName?: string;
  previewTargetName?: string;
  serveStaticTargetName?: string;
  typecheckTargetName?: string;
  /**
   * The compiler to use for type-checking. When unset, defaults to `vue-tsc`
   * for Vue projects (detected via the `vite:vue` plugin) and `tsc` otherwise.
   * Set to `tsgo` to use the TypeScript Go compiler (`@typescript/native-preview`),
   * or `vue-tsc` to force Vue-aware type-checking when auto-detection misses your setup.
   */
  compiler?: 'tsc' | 'tsgo' | 'vue-tsc';
  watchDepsTargetName?: string;
  buildDepsTargetName?: string;
}

type ViteTargets = Pick<
  ProjectConfiguration,
  'targets' | 'metadata' | 'projectType'
>;

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const viteConfigGlob = '**/vite.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodes: CreateNodesV2<VitePluginOptions> = [
  viteConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(workspaceDataDirectory, `vite-${optionsHash}.hash`);
    const targetsCache = new PluginCache<ViteTargets>(cachePath);
    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();

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

    const detectedPackageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(detectedPackageManager);
    const lockfile = getLockFileName(detectedPackageManager);
    const tsconfigChainsByProjectRoot = collectTsconfigInputsByProjectRoot(
      projectRoots,
      context.workspaceRoot
    );
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      { ...normalizedOptions, isUsingTsSolutionSetup },
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
          // Do not create a project if package.json and project.json isn't there.
          const siblingFiles = readdirSync(
            join(context.workspaceRoot, projectRoot)
          );

          const tsConfigFiles =
            siblingFiles.filter((p) =>
              picomatch('tsconfig*{.json,.*.json}')(p)
            ) ?? [];

          const hasReactRouterConfig = siblingFiles.some((configFile) => {
            const parts = configFile.split('.');
            return (
              parts[0] === 'react-router' &&
              parts[1] === 'config' &&
              parts.length > 2
            );
          });

          const hash = hashes[idx] + configFile;
          if (!targetsCache.has(hash)) {
            targetsCache.set(
              hash,
              await buildViteTargets(
                configFile,
                projectRoot,
                normalizedOptions,
                tsConfigFiles,
                hasReactRouterConfig,
                isUsingTsSolutionSetup,
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
          };

          // If project is buildable, then the project type.
          // If it is not buildable, then leave it to other plugins/project.json to set the project type.
          if (project.targets[normalizedOptions.buildTargetName]) {
            project.projectType = projectType;
          }

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

async function buildViteTargets(
  configFilePath: string,
  projectRoot: string,
  options: VitePluginOptions,
  tsConfigFiles: string[],
  hasReactRouterConfig: boolean,
  isUsingTsSolutionSetup: boolean,
  context: CreateNodesContextV2,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  tsconfigInputs: string[]
): Promise<ViteTargets> {
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
  const { resolveConfig } = await loadViteDynamicImport();
  const viteBuildConfig = await resolveConfig(
    {
      configFile: absoluteConfigFilePath,
      mode: 'development',
      root: projectRoot,
    },
    'build'
  );

  const metadata: ProjectConfiguration['metadata'] = {};

  const { buildOutputs, isBuildable, hasServeConfig } = getOutputs(
    viteBuildConfig,
    projectRoot,
    context.workspaceRoot
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  if (hasReactRouterConfig) {
    // If we have a react-router config, we can skip the rest of the targets
    return { targets, metadata: {}, projectType: 'application' };
  }
  const hasRemixPlugin =
    viteBuildConfig.plugins &&
    viteBuildConfig.plugins.some((p) => p.name === 'remix');
  if (!hasRemixPlugin && isBuildable) {
    targets[options.buildTargetName] = await buildTarget(
      options.buildTargetName,
      namedInputs,
      buildOutputs,
      projectRoot,
      isUsingTsSolutionSetup,
      pmc
    );

    // If running in library mode, then there is nothing to serve.
    if (!viteBuildConfig.build?.lib || hasServeConfig) {
      const devTarget = serveTarget(projectRoot, isUsingTsSolutionSetup, pmc);

      targets[options.serveTargetName] = {
        ...devTarget,
        metadata: {
          ...devTarget.metadata,
          deprecated:
            'Use devTargetName instead. This option will be removed in Nx 22.',
        },
      };
      targets[options.devTargetName] = devTarget;
      targets[options.previewTargetName] = previewTarget(
        projectRoot,
        options.buildTargetName,
        pmc
      );
      targets[options.serveStaticTargetName] = serveStaticTarget(
        options,
        isUsingTsSolutionSetup
      );
    }
  }

  if (tsConfigFiles.length) {
    const tsConfigToUse =
      ['tsconfig.app.json', 'tsconfig.lib.json', 'tsconfig.json'].find((t) =>
        tsConfigFiles.includes(t)
      ) ?? tsConfigFiles[0];

    // Check if the project uses Vue plugin
    const hasVuePlugin = viteBuildConfig.plugins?.some(
      (p) => p.name === 'vite:vue'
    );
    // Explicit `compiler` option wins over inference so users can override
    // when their setup isn't detected (e.g. custom/non-standard Vue plugin).
    const resolvedCompiler =
      options.compiler ?? (hasVuePlugin ? 'vue-tsc' : 'tsc');
    const typeCheckCommand = resolvedCompiler;
    const typeCheckExternalDeps =
      resolvedCompiler === 'tsgo'
        ? ['@typescript/native-preview']
        : resolvedCompiler === 'vue-tsc'
          ? ['vue-tsc', 'typescript']
          : ['typescript'];

    targets[options.typecheckTargetName] = {
      cache: true,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        { externalDependencies: typeCheckExternalDeps },
      ],
      command: isUsingTsSolutionSetup
        ? `${typeCheckCommand} --build --emitDeclarationOnly`
        : `${typeCheckCommand} --noEmit -p ${tsConfigToUse}`,
      options: { cwd: joinPathFragments(projectRoot) },
      metadata: {
        description: `Runs type-checking for the project.`,
        technologies: hasVuePlugin ? ['typescript', 'vue'] : ['typescript'],
        help: {
          command: isUsingTsSolutionSetup
            ? `${pmc.exec} ${typeCheckCommand} --build --help`
            : `${pmc.exec} ${typeCheckCommand} -p ${tsConfigToUse} --help`,
          example: isUsingTsSolutionSetup
            ? { args: ['--force'] }
            : { options: { noEmit: true } },
        },
      },
    };

    if (isUsingTsSolutionSetup) {
      targets[options.typecheckTargetName].dependsOn = [
        `^${options.typecheckTargetName}`,
      ];
      targets[options.typecheckTargetName].syncGenerators = [
        '@nx/js:typescript-sync',
      ];
    }
  }

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return {
    targets,
    metadata,
    projectType: viteBuildConfig.build?.lib ? 'library' : 'application',
  };
}

async function buildTarget(
  buildTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string,
  isUsingTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const buildTarget: TargetConfiguration = {
    command: `vite build`,
    options: { cwd: joinPathFragments(projectRoot) },
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['vite'],
      },
    ],
    outputs,
    metadata: {
      technologies: ['vite'],
      description: `Run Vite build`,
      help: {
        command: `${pmc.exec} vite build --help`,
        example: {
          options: {
            sourcemap: true,
            manifest: 'manifest.json',
          },
        },
      },
    },
  };

  if (isUsingTsSolutionSetup) {
    buildTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return buildTarget;
}

function serveTarget(
  projectRoot: string,
  isUsingTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const targetConfig: TargetConfiguration = {
    continuous: true,
    command: `vite`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    metadata: {
      technologies: ['vite'],
      description: `Starts Vite dev server`,
      help: {
        command: `${pmc.exec} vite --help`,
        example: {
          options: {
            port: 3000,
          },
        },
      },
    },
  };

  if (isUsingTsSolutionSetup) {
    targetConfig.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return targetConfig;
}

function previewTarget(
  projectRoot: string,
  buildTargetName: string,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const targetConfig: TargetConfiguration = {
    continuous: true,
    command: `vite preview`,
    dependsOn: [buildTargetName],
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    metadata: {
      technologies: ['vite'],
      description: `Locally preview Vite production build`,
      help: {
        command: `${pmc.exec} vite preview --help`,
        example: {
          options: {
            port: 3000,
          },
        },
      },
    },
  };

  return targetConfig;
}

function serveStaticTarget(
  options: VitePluginOptions,
  isUsingTsSolutionSetup: boolean
) {
  const targetConfig: TargetConfiguration = {
    continuous: true,
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildTargetName}`,
      spa: true,
    },
  };

  if (isUsingTsSolutionSetup) {
    targetConfig.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return targetConfig;
}

function getOutputs(
  viteBuildConfig: ResolvedConfig | undefined,
  projectRoot: string,
  workspaceRoot: string
): {
  buildOutputs: string[];
  isBuildable: boolean;
  hasServeConfig: boolean;
} {
  // TODO(jack): Remove this cast when @nx/vite switches to moduleResolution:
  // "nodenext". Vite 8's rolldown types are ESM-only (.d.mts) and not
  // resolvable under moduleResolution: "node", which breaks rolldownOptions
  // on ResolvedConfig.
  const { build, server } = viteBuildConfig as any;

  const buildOutputPath = normalizeOutputPath(
    build?.outDir,
    projectRoot,
    workspaceRoot,
    'dist'
  );

  const isBuildable = Boolean(
    build?.lib ||
      viteBuildConfig?.builder?.buildApp ||
      build?.rollupOptions?.input || // Vite <8
      build?.rolldownOptions?.input || // Vite >=8
      existsSync(join(workspaceRoot, projectRoot, 'index.html'))
  );

  const hasServeConfig = Boolean(server?.host || server?.port);

  return {
    buildOutputs: [buildOutputPath],
    isBuildable,
    hasServeConfig,
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string,
  workspaceRoot: string,
  path: 'dist'
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

function normalizeOptions(options: VitePluginOptions): VitePluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.devTargetName ??= 'dev';
  options.previewTargetName ??= 'preview';
  options.serveStaticTargetName ??= 'serve-static';
  options.typecheckTargetName ??= 'typecheck';
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

    // Walk the project tsconfig's extends chain
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

    // Walk UP ancestor directories — esbuild reads every tsconfig.json
    // between the entry point and the filesystem root.
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

    // Check the workspace root itself (dirname loop above stops at '.')
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
