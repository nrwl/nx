import {
  CreateDependencies,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  ProjectConfiguration,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { existsSync, readdirSync } from 'fs';
import { hashArray, hashFile, hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'path';
import { readRspackOptions } from '../utils/read-rspack-options';
import { resolveUserDefinedRspackConfig } from '../utils/resolve-user-defined-rspack-config';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

export interface RspackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type RspackTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

const pmc = getPackageManagerCommand();

function readTargetsCache(cachePath: string): Record<string, RspackTargets> {
  try {
    return process.env.NX_CACHE_PROJECT_GRAPH !== 'false'
      ? readJsonFile(cachePath)
      : {};
  } catch {
    return {};
  }
}

function writeTargetsToCache(
  cachePath,
  results?: Record<string, RspackTargets>
) {
  writeJsonFile(cachePath, results);
}

export const createDependencies: CreateDependencies = () => {
  return [];
};

const rspackConfigGlob = '**/rspack.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodesV2: CreateNodesV2<RspackPluginOptions> = [
  rspackConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `rspack-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    const isTsSolutionSetup = isUsingTsSolutionSetup();
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            isTsSolutionSetup
          ),
        configFilePaths,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: RspackPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, RspackTargets>,
  isTsSolutionSetup: boolean
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

  let packageJson = {};
  if (siblingFiles.includes('package.json')) {
    packageJson = readJsonFile(
      join(context.workspaceRoot, projectRoot, 'package.json')
    );
  }

  const normalizedOptions = normalizeOptions(options);

  const lockFileHash =
    hashFile(
      join(
        context.workspaceRoot,
        getLockFileName(detectPackageManager(context.workspaceRoot))
      )
    ) ?? '';

  const nodeHash = hashArray([
    hashFile(join(context.workspaceRoot, configFilePath)),
    lockFileHash,
    hashObject({ ...options, isTsSolutionSetup }),
    hashObject(packageJson),
  ]);
  // We do not want to alter how the hash is calculated, so appending the config file path to the hash
  // to prevent vite/vitest files overwriting the target cache created by the other
  const hash = `${nodeHash}_${configFilePath}`;

  targetsCache[hash] ??= await createRspackTargets(
    configFilePath,
    projectRoot,
    normalizedOptions,
    context,
    isTsSolutionSetup
  );

  const { targets, metadata } = targetsCache[hash];

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata,
      },
    },
  };
}

async function createRspackTargets(
  configFilePath: string,
  projectRoot: string,
  options: RspackPluginOptions,
  context: CreateNodesContext,
  isTsSolutionSetup: boolean
): Promise<RspackTargets> {
  const namedInputs = getNamedInputs(projectRoot, context);

  const rspackConfig = await resolveUserDefinedRspackConfig(
    join(context.workspaceRoot, configFilePath),
    getRootTsConfigPath(),
    true
  );

  const rspackOptions = await readRspackOptions(rspackConfig);

  const outputs = [];
  for (const config of rspackOptions) {
    if (config.output?.path) {
      outputs.push(normalizeOutputPath(config.output.path, projectRoot));
    }
  }

  const targets = {};

  const env: NodeJS.ProcessEnv = {};
  const isTsConfig = ['.ts', '.cts', '.mts'].includes(extname(configFilePath));
  if (isTsConfig) {
    // https://rspack.dev/config/#using-ts-node
    env['TS_NODE_COMPILER_OPTIONS'] = JSON.stringify({
      module: 'CommonJS',
      moduleResolution: 'Node10',
      customConditions: null,
    });
  }

  targets[options.buildTargetName] = {
    command: `rspack build`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
      env,
    },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs:
      'production' in namedInputs
        ? [
            'production',
            '^production',
            {
              externalDependencies: ['@rspack/cli'],
            },
          ]
        : [
            'default',
            '^default',
            {
              externalDependencies: ['@rspack/cli'],
            },
          ],
    outputs,
  };

  targets[options.serveTargetName] = {
    continuous: true,
    command: `rspack serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=development'],
      env,
    },
  };

  targets[options.previewTargetName] = {
    continuous: true,
    command: `rspack serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
      env,
    },
  };

  targets[options.serveStaticTargetName] = {
    dependsOn: [`${options.buildTargetName}`],
    continuous: true,
    executor: '@nx/web:file-server',
    options: {
      port: rspackConfig.devServer?.port,
      buildTarget: options.buildTargetName,
      spa: true,
    },
  };

  if (isTsSolutionSetup) {
    targets[options.buildTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
    targets[options.serveTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
    targets[options.previewTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
    targets[options.serveStaticTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
  }

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return { targets, metadata: {} };
}

function normalizeOptions(options: RspackPluginOptions): RspackPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.previewTargetName ??= 'preview';
  options.serveStaticTargetName ??= 'serve-static';
  return options;
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string
): string | undefined {
  if (!outputPath) {
    // If outputPath is undefined, use rspack's default `dist` directory.
    if (projectRoot === '.') {
      return `{projectRoot}/dist`;
    } else {
      return `{workspaceRoot}/dist/{projectRoot}`;
    }
  } else {
    if (isAbsolute(outputPath)) {
      /**
       * If outputPath is absolute, we need to resolve it relative to the workspaceRoot first.
       * After that, we can use the relative path to the workspaceRoot token {workspaceRoot} to generate the output path.
       */
      return `{workspaceRoot}/${relative(
        workspaceRoot,
        resolve(workspaceRoot, outputPath)
      )}`;
    } else {
      if (outputPath.startsWith('..')) {
        return join('{workspaceRoot}', join(projectRoot, outputPath));
      } else {
        return join('{projectRoot}', outputPath);
      }
    }
  }
}
