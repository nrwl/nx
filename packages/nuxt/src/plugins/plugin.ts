import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
  detectPackageManager,
  joinPathFragments,
  offsetFromRoot,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { basename, dirname, join } from 'path';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { loadNuxtKitDynamicImport } from '../utils/executor-utils';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';

const cachePath = join(projectGraphCacheDirectory, 'nuxt.hash');
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

export interface NuxtPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  testTargetName?: string;
}

export const createNodes: CreateNodes<NuxtPluginOptions> = [
  '**/nuxt.config.{js,ts}',
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
      : await buildNuxtTargets(configFilePath, projectRoot, options, context);

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

async function buildNuxtTargets(
  configFilePath: string,
  projectRoot: string,
  options: NuxtPluginOptions,
  context: CreateNodesContext
) {
  const nuxtConfig: {
    buildDir: string;
  } = await getInfoFromNuxtConfig(configFilePath, context, projectRoot);

  const { buildOutputs, testOutputs } = getOutputs(projectRoot, nuxtConfig);

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = buildTarget(
    context,
    namedInputs,
    buildOutputs,
    projectRoot,
    options
  );

  targets[options.serveTargetName] = serveTarget(projectRoot);

  targets[options.testTargetName] = testTarget(
    context,
    namedInputs,
    testOutputs,
    options,
    projectRoot
  );

  return targets;
}

function buildTarget(
  context: CreateNodesContext,
  namedInputs: {
    [inputName: string]: any[];
  },
  buildOutputs: string[],
  projectRoot: string,
  options: NuxtPluginOptions
) {
  const targetDefaults = readTargetDefaultsForTarget(
    options.buildTargetName,
    context.nxJsonConfiguration.targetDefaults
  );

  const targetConfig: TargetConfiguration = {
    command: `nuxi build`,
    options: {
      cwd: projectRoot,
    },
  };

  if (targetDefaults?.outputs === undefined) {
    targetConfig.outputs = buildOutputs;
  }

  if (targetDefaults?.cache === undefined) {
    targetConfig.cache = true;
  }

  if (targetDefaults?.inputs === undefined) {
    targetConfig.inputs = [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),

      {
        externalDependencies: ['nuxi'],
      },
    ];
  }
  return targetConfig;
}

function serveTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `nuxi dev`,
    options: {
      cwd: projectRoot,
    },
  };

  return targetConfig;
}

function testTarget(
  context: CreateNodesContext,
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  options: NuxtPluginOptions,
  projectRoot: string
) {
  const targetDefaults = readTargetDefaultsForTarget(
    options.testTargetName,
    context.nxJsonConfiguration.targetDefaults
  );

  const targetConfig: TargetConfiguration = {
    command: `vitest run`,
    options: {
      cwd: projectRoot,
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
        ? ['default', '^production']
        : ['default', '^default']),

      {
        externalDependencies: ['vitest'],
      },
    ];
  }

  return targetConfig;
}

async function getInfoFromNuxtConfig(
  configFilePath: string,
  context: CreateNodesContext,
  projectRoot: string
): Promise<{
  buildDir: string;
}> {
  const { loadNuxtConfig } = await loadNuxtKitDynamicImport();
  const config = await loadNuxtConfig({
    cwd: joinPathFragments(context.workspaceRoot, projectRoot),
    configFile: basename(configFilePath),
  });

  return {
    // to preserve only the relative path from the workspace root
    // because nuxt automatically prepends the rootDir to buildDir
    buildDir: config?.buildDir?.replace(config?.rootDir, ''),
  };
}

function getOutputs(
  projectRoot: string,
  nuxtConfig: {
    buildDir: string;
  }
): {
  buildOutputs: string[];
  outputPath: string;
  testOutputs: string[];
  reportsDirectory: string;
} {
  const buildOutputs = ['{options.outputPath}'];
  const testOutputs = ['{options.reportsDirectory}'];

  function getOutput(path: string, projectRoot: string): string {
    if (path.startsWith('..')) {
      return join('{workspaceRoot}', join(projectRoot, path));
    } else {
      return join('{projectRoot}', path);
    }
  }

  let distPath = undefined;
  if (nuxtConfig?.buildDir && basename(nuxtConfig?.buildDir) === '.nuxt') {
    // buildDir will most probably be `../dist/my-app/.nuxt`
    // we want the "general" outputPath to be `../dist/my-app`
    distPath = nuxtConfig.buildDir.replace(basename(nuxtConfig.buildDir), '');
    buildOutputs.push(getOutput(distPath, projectRoot));
  }

  const outputPath = distPath ?? joinPathFragments('dist', projectRoot);

  const reportsDirectory = joinPathFragments(
    offsetFromRoot(projectRoot),
    'coverage',
    projectRoot
  );

  testOutputs.push(getOutput(reportsDirectory, projectRoot));

  return { buildOutputs, outputPath, testOutputs, reportsDirectory };
}

function normalizeOptions(options: NuxtPluginOptions): NuxtPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.testTargetName ??= 'test';
  return options;
}
