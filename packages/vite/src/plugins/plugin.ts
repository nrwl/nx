import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  joinPathFragments,
  readJsonFile,
  TargetConfiguration,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, isAbsolute, join, relative } from 'path';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { loadViteDynamicImport } from '../utils/executor-utils';

export interface VitePluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  serveTargetName?: string;
  previewTargetName?: string;
  serveStaticTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'vite.hash');
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

export const createNodes: CreateNodes<VitePluginOptions> = [
  '**/{vite,vitest}.config.{js,ts,mjs,mts,cjs,cts}',
  async (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);
    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options = normalizeOptions(options);

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);
    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : await buildViteTargets(configFilePath, projectRoot, options, context);

    calculatedTargets[hash] = targets;

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets,
        },
      },
    };
  },
];

async function buildViteTargets(
  configFilePath: string,
  projectRoot: string,
  options: VitePluginOptions,
  context: CreateNodesContext
) {
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
    projectRoot
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  // If file is not vitest.config and buildable, create targets for build, serve, preview and serve-static
  if (!configFilePath.includes('vitest.config') && isBuildable) {
    targets[options.buildTargetName] = await buildTarget(
      options.buildTargetName,
      namedInputs,
      buildOutputs,
      projectRoot
    );

    targets[options.serveTargetName] = serveTarget(projectRoot);

    targets[options.previewTargetName] = previewTarget(projectRoot);

    targets[options.serveStaticTargetName] = serveStaticTarget(options) as {};
  }

  // if file is vitest.config or vite.config has definition for test, create target for test
  if (configFilePath.includes('vitest.config') || hasTest) {
    targets[options.testTargetName] = await testTarget(
      namedInputs,
      testOutputs,
      projectRoot
    );
  }

  return targets;
}

async function buildTarget(
  buildTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string
) {
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
  };
}

function serveTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `vite serve`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
  };

  return targetConfig;
}

function previewTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `vite preview`,
    options: {
      cwd: joinPathFragments(projectRoot),
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
    command: `vitest run`,
    options: { cwd: joinPathFragments(projectRoot) },
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['vitest'],
      },
    ],
    outputs,
  };
}

function serveStaticTarget(options: VitePluginOptions) {
  const targetConfig: TargetConfiguration = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildTargetName}`,
    },
  };

  return targetConfig;
}

function getOutputs(
  viteConfig: Record<string, any> | undefined,
  projectRoot: string
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
    'dist'
  );

  const isBuildable =
    build?.lib ||
    build?.rollupOptions?.inputs ||
    existsSync(join(workspaceRoot, projectRoot, 'index.html'));

  const reportsDirectoryPath = normalizeOutputPath(
    test?.coverage?.reportsDirectory,
    projectRoot,
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
