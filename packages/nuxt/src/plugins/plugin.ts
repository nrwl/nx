import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  readJsonFile,
  TargetConfiguration,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, isAbsolute, join, relative } from 'path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

const cachePath = join(workspaceDataDirectory, 'nuxt.hash');
const targetsCache = readTargetsCache();

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache() {
  const oldCache = readTargetsCache();
  writeJsonFile(cachePath, {
    ...oldCache,
    ...targetsCache,
  });
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache();
  return [];
};

export interface NuxtPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  buildStaticTargetName?: string;
}

export const createNodes: CreateNodes<NuxtPluginOptions> = [
  '**/nuxt.config.{js,ts,mjs,mts,cjs,cts}',
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

    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options,
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    );
    targetsCache[hash] ??= await buildNuxtTargets(
      configFilePath,
      projectRoot,
      options,
      context
    );

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets: targetsCache[hash],
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

  const { buildOutputs } = getOutputs(nuxtConfig, projectRoot);

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = buildTarget(
    options.buildTargetName,
    namedInputs,
    buildOutputs,
    projectRoot
  );

  targets[options.serveTargetName] = serveTarget(projectRoot);

  targets[options.serveStaticTargetName] = serveStaticTarget(options);

  targets[options.buildStaticTargetName] = buildStaticTarget(
    options.buildStaticTargetName,
    namedInputs,
    buildOutputs,
    projectRoot
  );

  return targets;
}

function buildTarget(
  buildTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  buildOutputs: string[],
  projectRoot: string
) {
  return {
    command: `nuxt build`,
    options: { cwd: projectRoot },
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),

      {
        externalDependencies: ['nuxt'],
      },
    ],
    outputs: buildOutputs,
  };
}

function serveTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `nuxt dev`,
    options: {
      cwd: projectRoot,
    },
  };

  return targetConfig;
}

function serveStaticTarget(options: NuxtPluginOptions) {
  const targetConfig: TargetConfiguration = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildStaticTargetName}`,
      staticFilePath: '{projectRoot}/dist',
      port: 4200,
      // Routes are found correctly with serve-static
      spa: false,
    },
  };

  return targetConfig;
}

function buildStaticTarget(
  buildStaticTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  buildOutputs: string[],
  projectRoot: string
) {
  const targetConfig: TargetConfiguration = {
    command: `nuxt build --prerender`,
    options: { cwd: projectRoot },
    cache: true,
    dependsOn: [`^${buildStaticTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),

      {
        externalDependencies: ['nuxt'],
      },
    ],
    outputs: buildOutputs,
  };
  return targetConfig;
}

async function getInfoFromNuxtConfig(
  configFilePath: string,
  context: CreateNodesContext,
  projectRoot: string
): Promise<{
  buildDir: string;
}> {
  // TODO(Colum): Once plugins are isolated we can go back to @nuxt/kit since each plugin will be run in its own worker.
  const config = await loadConfigFile(
    join(context.workspaceRoot, configFilePath)
  );
  return {
    buildDir:
      config?.buildDir ??
      // Match .nuxt default build dir from '@nuxt/schema'
      // See: https://github.com/nuxt/nuxt/blob/871404ae5673425aeedde82f123ea58aa7c6facf/packages/schema/src/config/common.ts#L117-L119
      '.nuxt',
  };
}

function getOutputs(
  nuxtConfig: { buildDir: string },
  projectRoot: string
): {
  buildOutputs: string[];
} {
  const buildOutputPath = normalizeOutputPath(
    nuxtConfig?.buildDir,
    projectRoot
  );

  return {
    buildOutputs: [buildOutputPath, '{projectRoot}/.output'],
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string
): string {
  if (!outputPath) {
    if (projectRoot === '.') {
      return `{projectRoot}`;
    } else {
      return `{workspaceRoot}/{projectRoot}`;
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

function normalizeOptions(options: NuxtPluginOptions): NuxtPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.serveStaticTargetName ??= 'serve-static';
  options.buildStaticTargetName ??= 'build-static';
  return options;
}
