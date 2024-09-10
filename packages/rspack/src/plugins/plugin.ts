import {
  CreateDependencies,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  ProjectConfiguration,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import { existsSync, readdirSync } from 'fs';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { readRspackOptions } from '../utils/read-rspack-options';
import { resolveUserDefinedRspackConfig } from '../utils/resolve-user-defined-rspack-config';

export interface RspackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
}

type RspackTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(cachePath: string): Record<string, RspackTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
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

async function createNodesInternal(
  configFilePath: string,
  options: RspackPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, RspackTargets>
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

  targetsCache[hash] ??= await createRspackTargets(
    configFilePath,
    projectRoot,
    normalizedOptions,
    context
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
  context: CreateNodesContext
): Promise<RspackTargets> {
  const namedInputs = getNamedInputs(projectRoot, context);

  const rspackConfig = resolveUserDefinedRspackConfig(
    join(context.workspaceRoot, configFilePath),
    getRootTsConfigPath(),
    true
  );

  const rspackOptions = await readRspackOptions(rspackConfig);

  const outputPath = normalizeOutputPath(
    rspackOptions.output?.path,
    projectRoot
  );

  const targets = {};

  targets[options.buildTargetName] = {
    command: `rspack build`,
    options: { cwd: projectRoot, args: ['--node-env=production'] },
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
    outputs: [outputPath],
  };

  targets[options.serveTargetName] = {
    command: `rspack serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=development'],
    },
  };

  targets[options.previewTargetName] = {
    command: `rspack serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
    },
  };

  targets[options.serveStaticTargetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
      spa: true,
    },
  };

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
