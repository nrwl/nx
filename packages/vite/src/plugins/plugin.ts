import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, isAbsolute, join, relative } from 'path';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import {
  calculateHashesForCreateNodes,
  calculateHashForCreateNodes,
} from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { hashObject } from 'nx/src/hasher/file-hasher';
import picomatch = require('picomatch');
import { isUsingTsSolutionSetup as _isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

const pmc = getPackageManagerCommand();

export interface VitePluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  /**
   * @deprecated Use devTargetName instead. This option will be removed in Nx 22.
   */
  serveTargetName?: string;
  devTargetName?: string;
  previewTargetName?: string;
  serveStaticTargetName?: string;
  typecheckTargetName?: string;
  watchDepsTargetName?: string;
  buildDepsTargetName?: string;
}

type ViteTargets = Pick<
  ProjectConfiguration,
  'targets' | 'metadata' | 'projectType'
>;

function readTargetsCache(cachePath: string): Record<string, ViteTargets> {
  return process.env.NX_CACHE_PROJECT_GRAPH !== 'false' && existsSync(cachePath)
    ? readJsonFile(cachePath)
    : {};
}

function writeTargetsToCache(cachePath, results?: Record<string, ViteTargets>) {
  writeJsonFile(cachePath, results);
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const viteVitestConfigGlob = '**/{vite,vitest}.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodesV2: CreateNodesV2<VitePluginOptions> = [
  viteVitestConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(workspaceDataDirectory, `vite-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);
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

    const lockfile = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      { ...normalizedOptions, isUsingTsSolutionSetup },
      context,
      projectRoots.map((r) => [lockfile])
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

          // results from vitest.config.js will be different from results of vite.config.js
          // but the hash will be the same because it is based on the files under the project root.
          // Adding the config file path to the hash ensures that the final hash value is different
          // for different config files.
          const hash = hashes[idx] + configFile;
          const { projectType, metadata, targets } = (targetsCache[hash] ??=
            await buildViteTargets(
              configFile,
              projectRoot,
              normalizedOptions,
              tsConfigFiles,
              hasReactRouterConfig,
              isUsingTsSolutionSetup,
              context
            ));

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
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodes: CreateNodes<VitePluginOptions> = [
  viteVitestConfigGlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    const projectRoot = dirname(configFilePath);
    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    const tsConfigFiles =
      siblingFiles.filter((p) => picomatch('tsconfig*{.json,.*.json}')(p)) ??
      [];

    const hasReactRouterConfig = siblingFiles.some((configFile) => {
      const parts = configFile.split('.');
      return (
        parts[0] === 'react-router' && parts[1] === 'config' && parts.length > 2
      );
    });

    const normalizedOptions = normalizeOptions(options);

    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();

    const { projectType, metadata, targets } = await buildViteTargets(
      configFilePath,
      projectRoot,
      normalizedOptions,
      tsConfigFiles,
      hasReactRouterConfig,
      isUsingTsSolutionSetup,
      context
    );
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
];

async function buildViteTargets(
  configFilePath: string,
  projectRoot: string,
  options: VitePluginOptions,
  tsConfigFiles: string[],
  hasReactRouterConfig: boolean,
  isUsingTsSolutionSetup: boolean,
  context: CreateNodesContext
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
  const { resolveConfig } = await loadViteDynamicImport();
  const viteBuildConfig = await resolveConfig(
    {
      configFile: absoluteConfigFilePath,
      mode: 'development',
    },
    'build'
  );

  const { buildOutputs, testOutputs, hasTest, isBuildable, hasServeConfig } =
    getOutputs(viteBuildConfig, projectRoot, context.workspaceRoot);

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  // if file is vitest.config or vite.config has definition for test, create target for test
  if (configFilePath.includes('vitest.config') || hasTest) {
    targets[options.testTargetName] = await testTarget(
      namedInputs,
      testOutputs,
      projectRoot
    );
  }

  if (hasReactRouterConfig) {
    // If we have a react-router config, we can skip the rest of the targets
    return { targets, metadata: {}, projectType: 'application' };
  }
  // If file is not vitest.config and buildable, create targets for build, serve, preview and serve-static
  const hasRemixPlugin =
    viteBuildConfig.plugins &&
    viteBuildConfig.plugins.some((p) => p.name === 'remix');
  if (
    !configFilePath.includes('vitest.config') &&
    !hasRemixPlugin &&
    isBuildable
  ) {
    targets[options.buildTargetName] = await buildTarget(
      options.buildTargetName,
      namedInputs,
      buildOutputs,
      projectRoot,
      isUsingTsSolutionSetup
    );

    // If running in library mode, then there is nothing to serve.
    if (!viteBuildConfig.build?.lib || hasServeConfig) {
      const devTarget = serveTarget(projectRoot, isUsingTsSolutionSetup);

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
        options.buildTargetName
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
    const typeCheckCommand = hasVuePlugin ? 'vue-tsc' : 'tsc';

    targets[options.typecheckTargetName] = {
      cache: true,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: hasVuePlugin
            ? ['vue-tsc', 'typescript']
            : ['typescript'],
        },
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

  const metadata = {};
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
  isUsingTsSolutionSetup: boolean
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

function serveTarget(projectRoot: string, isUsingTsSolutionSetup: boolean) {
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

function previewTarget(projectRoot: string, buildTargetName) {
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

async function testTarget(
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string
) {
  return {
    command: `vitest`,
    options: { cwd: joinPathFragments(projectRoot) },
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['vitest'],
      },
      { env: 'CI' },
    ],
    outputs,
    metadata: {
      technologies: ['vite'],
      description: `Run Vite tests`,
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
  viteBuildConfig: Record<string, any> | undefined,
  projectRoot: string,
  workspaceRoot: string
): {
  buildOutputs: string[];
  testOutputs: string[];
  hasTest: boolean;
  isBuildable: boolean;
  hasServeConfig: boolean;
} {
  const { build, test, server } = viteBuildConfig;

  const buildOutputPath = normalizeOutputPath(
    build?.outDir,
    projectRoot,
    workspaceRoot,
    'dist'
  );

  const isBuildable =
    build?.lib ||
    build?.rollupOptions?.input ||
    existsSync(join(workspaceRoot, projectRoot, 'index.html'));

  const hasServeConfig = Boolean(server);

  const reportsDirectoryPath = normalizeOutputPath(
    test?.coverage?.reportsDirectory,
    projectRoot,
    workspaceRoot,
    'coverage'
  );

  return {
    buildOutputs: [buildOutputPath],
    testOutputs: [reportsDirectoryPath],
    hasTest: !!test,
    isBuildable,
    hasServeConfig,
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string,
  workspaceRoot: string,
  path: 'coverage' | 'dist'
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
        return join('{workspaceRoot}', join(projectRoot, outputPath));
      } else {
        return join('{projectRoot}', outputPath);
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
  options.testTargetName ??= 'test';
  options.serveStaticTargetName ??= 'serve-static';
  options.typecheckTargetName ??= 'typecheck';
  return options;
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContext | CreateNodesContextV2
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
