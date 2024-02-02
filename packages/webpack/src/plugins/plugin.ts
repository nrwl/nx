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
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { WebpackExecutorOptions } from '../executors/webpack/schema';
import { WebDevServerOptions } from '../executors/dev-server/schema';
import { existsSync, readdirSync } from 'fs';
import { readWebpackOptions } from '../utils/webpack/read-webpack-options';
import { resolveUserDefinedWebpackConfig } from '../utils/webpack/resolve-user-defined-webpack-config';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';

export interface WebpackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'webpack.hash');
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

export const createNodes: CreateNodes<WebpackPluginOptions> = [
  '**/webpack.config.{js,ts,mjs,cjs}',
  async (configFilePath, options, context) => {
    options ??= {};
    options.buildTargetName ??= 'build';
    options.serveTargetName ??= 'serve';
    options.serveStaticTargetName ??= 'serve-static';
    options.previewTargetName ??= 'preview';

    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);
    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : await createWebpackTargets(
          configFilePath,
          projectRoot,
          options,
          context
        );

    return {
      projects: {
        [projectRoot]: {
          projectType: 'application',
          targets,
        },
      },
    };
  },
];

async function createWebpackTargets(
  configFilePath: string,
  projectRoot: string,
  options: WebpackPluginOptions,
  context: CreateNodesContext
): Promise<
  Record<
    string,
    TargetConfiguration<WebpackExecutorOptions | WebDevServerOptions>
  >
> {
  const namedInputs = getNamedInputs(projectRoot, context);

  const webpackConfig = resolveUserDefinedWebpackConfig(
    join(context.workspaceRoot, configFilePath),
    getRootTsConfigPath(),
    true
  );

  const webpackOptions = await readWebpackOptions(webpackConfig);

  const outputPath = normalizeOutputPath(
    webpackOptions.output?.path,
    projectRoot
  );

  const targets = {};

  targets[options.buildTargetName] = {
    command: `webpack-cli build`,
    options: { cwd: projectRoot, args: ['--node-env=production'] },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs:
      'production' in namedInputs
        ? [
            'production',
            '^production',
            {
              externalDependencies: ['webpack-cli'],
            },
          ]
        : [
            'default',
            '^default',
            {
              externalDependencies: ['webpack-cli'],
            },
          ],
    outputs: [outputPath],
  };

  targets[options.serveTargetName] = {
    command: `webpack-cli serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=development'],
    },
  };

  targets[options.previewTargetName] = {
    command: `webpack-cli serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
    },
  };

  targets[options.serveStaticTargetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
    },
  };

  return targets;
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string
): string | undefined {
  if (!outputPath) {
    // If outputPath is undefined, use webpack's default `dist` directory.
    if (projectRoot === '.') {
      return `{projectRoot}/dist}`;
    } else {
      return `{workspaceRoot}/dist/{projectRoot}`;
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
