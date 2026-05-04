import {
  getNamedInputs,
  calculateHashForCreateNodes,
  loadConfigFile,
  PluginCache,
} from '@nx/devkit/internal';
import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { readdirSync } from 'fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/devkit-internals';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

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
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type ExpoTargets = Record<string, TargetConfiguration<ExpoPluginOptions>>;

export const createNodes: CreateNodesV2<ExpoPluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `expo-${optionsHash}.hash`);
    const targetsCache = new PluginCache<ExpoTargets>(cachePath);
    const pmc = getPackageManagerCommand(
      detectPackageManager(context.workspaceRoot)
    );

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache, pmc),
        configFiles,
        options,
        context
      );
    } finally {
      targetsCache.writeToDisk(cachePath);
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFile: string,
  options: ExpoPluginOptions,
  context: CreateNodesContextV2,
  targetsCache: PluginCache<ExpoTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<CreateNodesResult> {
  options = normalizeOptions(options);
  const projectRoot = dirname(configFile);

  // Do not create a project if package.json or project.json or metro.config.js isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') ||
    !siblingFiles.includes('metro.config.js')
  ) {
    return {};
  }

  // Check if it's an Expo project
  const packageJson = readJsonFile(
    join(context.workspaceRoot, projectRoot, 'package.json')
  );
  const appConfig = await getAppConfig(configFile, context);
  if (
    !appConfig.expo &&
    !packageJson.dependencies?.['expo'] &&
    !packageJson.devDependencies?.['expo']
  ) {
    return {};
  }

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      buildExpoTargets(projectRoot, options, context, pmc)
    );
  }

  return {
    projects: {
      [projectRoot]: {
        targets: targetsCache.get(hash),
      },
    },
  };
}

function buildExpoTargets(
  projectRoot: string,
  options: ExpoPluginOptions,
  context: CreateNodesContextV2,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {
    [options.startTargetName]: {
      executor: `@nx/expo:start`,
      continuous: true,
    },
    [options.serveTargetName]: {
      command: `expo start --web`,
      continuous: true,
      options: { cwd: projectRoot, args: ['--clear'] },
    },
    [options.runIosTargetName]: {
      command: `expo run:ios`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.runAndroidTargetName]: {
      command: `expo run:android`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.exportTargetName]: {
      command: `expo export`,
      options: { cwd: projectRoot, args: ['--clear'] },
      cache: true,
      dependsOn: [`^${options.exportTargetName}`],
      inputs: getInputs(namedInputs),
      outputs: [getOutputs(projectRoot, 'dist')],
    },
    [options.installTargetName]: {
      executor: '@nx/expo:install',
    },
    [options.prebuildTargetName]: {
      executor: `@nx/expo:prebuild`,
    },
    [options.buildTargetName]: {
      executor: `@nx/expo:build`,
    },
    [options.submitTargetName]: {
      command: `eas submit`,
      options: { cwd: projectRoot },
    },
  };

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return targets;
}

function getAppConfig(
  configFilePath: string,
  context: CreateNodesContextV2
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
