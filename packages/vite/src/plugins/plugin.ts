import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
  detectPackageManager,
  joinPathFragments,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, isAbsolute, join, relative, resolve } from 'path';

import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { UserConfig, loadConfigFromFile } from 'vite';
import { existsSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
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
  '**/vite.config.{js,ts}',
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
  const viteConfig = await loadConfigFromFile(
    {
      command: 'build',
      mode: 'production',
    },
    configFilePath
  );

  const { buildOutputs, testOutputs } = getOutputs(
    projectRoot,
    viteConfig?.config
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = await buildTarget(
    context,
    namedInputs,
    buildOutputs,
    options,
    projectRoot
  );

  targets[options.serveTargetName] = serveTarget(projectRoot);

  targets[options.previewTargetName] = previewTarget(projectRoot);

  targets[options.testTargetName] = await testTarget(
    context,
    namedInputs,
    testOutputs,
    options,
    projectRoot
  );

  targets[options.serveStaticTargetName] = serveStaticTarget(options) as {};

  return targets;
}

async function buildTarget(
  context: CreateNodesContext,
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  options: VitePluginOptions,
  projectRoot: string
) {
  const targetDefaults = readTargetDefaultsForTarget(
    options.buildTargetName,
    context.nxJsonConfiguration.targetDefaults
  );

  const targetConfig: TargetConfiguration = {
    command: `vite build`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
  };

  if (targetDefaults?.outputs === undefined) {
    targetConfig.outputs = outputs;
  }

  if (targetDefaults?.cache === undefined) {
    targetConfig.cache = true;
  }

  if (targetDefaults?.inputs === undefined) {
    targetConfig.inputs = [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['vite'],
      },
    ];
  }

  return targetConfig;
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
  context: CreateNodesContext,
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  options: VitePluginOptions,
  projectRoot: string
) {
  const targetDefaults = readTargetDefaultsForTarget(
    options.testTargetName,
    context.nxJsonConfiguration.targetDefaults
  );

  const targetConfig: TargetConfiguration = {
    command: `vitest run`,
    options: {
      cwd: joinPathFragments(projectRoot),
    },
  };

  if (targetDefaults?.outputs === undefined) {
    targetConfig.outputs = outputs;
  }

  if (targetDefaults?.cache === undefined) {
    targetConfig.cache = true;
  }

  if (targetDefaults?.inputs === undefined) {
    targetConfig.inputs = [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['vitest'],
      },
    ];
  }
  return targetConfig;
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
  projectRoot: string,
  viteConfig: UserConfig
): {
  buildOutputs: string[];
  testOutputs: string[];
} {
  const { build, test } = viteConfig;
  const buildOutputs = ['{options.outputPath}'];
  const testOutputs = ['{options.reportsDirectory}'];

  function getOutput(path: string, projectRoot: string): string {
    if (path.startsWith('..')) {
      return join('{workspaceRoot}', join(projectRoot, path));
    } else if (isAbsolute(resolve(path))) {
      return `{workspaceRoot}/${relative(workspaceRoot, path)}`;
    } else {
      return join('{projectRoot}', path);
    }
  }

  if (build?.outDir) {
    buildOutputs.push(getOutput(build.outDir, projectRoot));
  }

  if (test?.coverage?.reportsDirectory) {
    testOutputs.push(getOutput(test.coverage.reportsDirectory, projectRoot));
  }

  return { buildOutputs, testOutputs };
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
