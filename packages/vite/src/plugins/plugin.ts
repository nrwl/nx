import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
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
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { hashObject } from 'nx/src/hasher/file-hasher';

export interface VitePluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  previewTargetName?: string;
  serveStaticTargetName?: string;
}

type ViteTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(cachePath: string): Record<string, ViteTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
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
    const cachePath = join(workspaceDataDirectory, `vite-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFilePaths,
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
    return createNodesInternal(configFilePath, options, context, {});
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: VitePluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, ViteTargets>
) {
  const projectRoot = dirname(configFilePath);
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  const normalizedOptions = normalizeOptions(options);

  // We do not want to alter how the hash is calculated, so appending the config file path to the hash
  // to prevent vite/vitest files overwriting the target cache created by the other
  const hash =
    (await calculateHashForCreateNodes(
      projectRoot,
      normalizedOptions,
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    )) + configFilePath;

  targetsCache[hash] ??= await buildViteTargets(
    configFilePath,
    projectRoot,
    normalizedOptions,
    context
  );

  const { targets, metadata } = targetsCache[hash];
  const project: ProjectConfiguration = {
    root: projectRoot,
    targets,
    metadata,
  };

  // If project is buildable, then the project type.
  // If it is not buildable, then leave it to other plugins/project.json to set the project type.
  if (project.targets[options.buildTargetName]) {
    project.projectType = project.targets[options.serveTargetName]
      ? 'application'
      : 'library';
  }

  return {
    projects: {
      [projectRoot]: project,
    },
  };
}

async function buildViteTargets(
  configFilePath: string,
  projectRoot: string,
  options: VitePluginOptions,
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
  const viteConfig = await resolveConfig(
    {
      configFile: absoluteConfigFilePath,
      mode: 'development',
    },
    'build'
  );

  const { buildOutputs, testOutputs, hasTest, isBuildable } = getOutputs(
    viteConfig,
    projectRoot,
    context.workspaceRoot
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  // If file is not vitest.config and buildable, create targets for build, serve, preview and serve-static
  const hasRemixPlugin =
    viteConfig.plugins && viteConfig.plugins.some((p) => p.name === 'remix');
  if (
    !configFilePath.includes('vitest.config') &&
    !hasRemixPlugin &&
    isBuildable
  ) {
    targets[options.buildTargetName] = await buildTarget(
      options.buildTargetName,
      namedInputs,
      buildOutputs,
      projectRoot
    );

    // If running in library mode, then there is nothing to serve.
    if (!viteConfig.build?.lib) {
      targets[options.serveTargetName] = serveTarget(projectRoot);
      targets[options.previewTargetName] = previewTarget(projectRoot);
      targets[options.serveStaticTargetName] = serveStaticTarget(options) as {};
    }
  }

  // if file is vitest.config or vite.config has definition for test, create target for test
  if (configFilePath.includes('vitest.config') || hasTest) {
    targets[options.testTargetName] = await testTarget(
      namedInputs,
      testOutputs,
      projectRoot
    );
  }

  const metadata = {};
  return { targets, metadata };
}

async function buildTarget(
  buildTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string
) {
  const pmc = getPackageManagerCommand();
  return {
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
      help: { command: `${pmc.exec} vite build --help` },
    },
  };
}

function serveTarget(projectRoot: string) {
  const pmc = getPackageManagerCommand();
  const targetConfig: TargetConfiguration = {
    command: `vite serve`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    metadata: {
      technologies: ['vite'],
      description: `Start Vite dev server`,
      help: { command: `${pmc.exec} vite --help` },
    },
  };

  return targetConfig;
}

function previewTarget(projectRoot: string) {
  const pmc = getPackageManagerCommand();
  const targetConfig: TargetConfiguration = {
    command: `vite preview`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
    metadata: {
      technologies: ['vite'],
      description: `Locally preview Vite production build`,
      help: { command: `${pmc.exec} vite preview --help` },
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
  const pmc = getPackageManagerCommand();
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
      help: { command: `${pmc.exec} vitest --help` },
    },
  };
}

function serveStaticTarget(options: VitePluginOptions) {
  const targetConfig: TargetConfiguration = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildTargetName}`,
      spa: true,
    },
  };

  return targetConfig;
}

function getOutputs(
  viteConfig: Record<string, any> | undefined,
  projectRoot: string,
  workspaceRoot: string
): {
  buildOutputs: string[];
  testOutputs: string[];
  hasTest: boolean;
  isBuildable: boolean;
} {
  const { build, test } = viteConfig;

  const buildOutputPath = normalizeOutputPath(
    build?.outDir,
    projectRoot,
    workspaceRoot,
    'dist'
  );

  const isBuildable =
    build?.lib ||
    build?.rollupOptions?.inputs ||
    existsSync(join(workspaceRoot, projectRoot, 'index.html'));

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
  options.previewTargetName ??= 'preview';
  options.testTargetName ??= 'test';
  options.serveStaticTargetName ??= 'serve-static';
  return options;
}
