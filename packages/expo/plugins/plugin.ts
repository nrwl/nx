import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface ExpoPluginOptions {
  startTargetName?: string;
  serveTargetName?: string;
  runIosTargetName?: string;
  runAndroidTargetName?: string;
  exportTargetName?: string;
  prebuildTargetName?: string;
  installTargetName?: string;
  buildTargetName?: string;
  submitTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'expo.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration<ExpoPluginOptions>>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<
    string,
    Record<string, TargetConfiguration<ExpoPluginOptions>>
  >
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<ExpoPluginOptions> = [
  '**/app.{json,config.js}',
  async (configFilePath, options, context) => {
    options = normalizeOptions(options);
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json or project.json or metro.config.js isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') ||
      !siblingFiles.includes('metro.config.js')
    ) {
      return {};
    }
    const appConfig = await getAppConfig(configFilePath, context);
    // if appConfig.expo is not defined
    if (!appConfig.expo) {
      return {};
    }

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);

    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : buildExpoTargets(projectRoot, options, context);

    calculatedTargets[hash] = targets;

    return {
      projects: {
        [projectRoot]: {
          targets,
        },
      },
    };
  },
];

function buildExpoTargets(
  projectRoot: string,
  options: ExpoPluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {
    [options.startTargetName]: {
      command: `expo start`,
      options: { cwd: projectRoot },
    },
    [options.serveTargetName]: {
      command: `expo start --web`,
      options: { cwd: projectRoot },
    },
    [options.runIosTargetName]: {
      command: `expo run:ios`,
      options: { cwd: projectRoot },
    },
    [options.runAndroidTargetName]: {
      command: `expo run:android`,
      options: { cwd: projectRoot },
    },
    [options.exportTargetName]: {
      command: `expo export`,
      options: { cwd: projectRoot },
      cache: true,
      dependsOn: [`^${options.exportTargetName}`],
      inputs: getInputs(namedInputs),
      outputs: [getOutputs(projectRoot, 'dist')],
    },
    [options.installTargetName]: {
      command: `expo install`,
      options: { cwd: workspaceRoot }, // install at workspace root
    },
    [options.prebuildTargetName]: {
      executor: `@nx/expo:prebuild`,
    },
    [options.buildTargetName]: {
      command: `eas build`,
      options: { cwd: projectRoot },
    },
    [options.submitTargetName]: {
      command: `eas submit`,
      options: { cwd: projectRoot },
    },
  };

  return targets;
}

function getAppConfig(
  configFilePath: string,
  context: CreateNodesContext
): Promise<any> {
  const resolvedPath = join(context.workspaceRoot, configFilePath);

  return loadConfigFile(resolvedPath);
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['expo'],
    },
  ];
}

function getOutputs(projectRoot: string, dir: string) {
  if (projectRoot === '.') {
    return `{projectRoot}/${dir}`;
  } else {
    return `{workspaceRoot}/${projectRoot}/${dir}`;
  }
}

function normalizeOptions(options: ExpoPluginOptions): ExpoPluginOptions {
  options ??= {};
  options.startTargetName ??= 'start';
  options.serveTargetName ??= 'serve';
  options.runIosTargetName ??= 'run-ios';
  options.runAndroidTargetName ??= 'run-android';
  options.exportTargetName ??= 'export';
  options.prebuildTargetName ??= 'prebuild';
  options.installTargetName ??= 'install';
  options.buildTargetName ??= 'build';
  options.submitTargetName ??= 'submit';
  return options;
}
