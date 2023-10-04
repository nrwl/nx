import {
  createProjectGraphAsync,
  ExecutorContext,
  logger,
  ProjectGraphProjectNode,
  workspaceRoot,
} from '@nx/devkit';
import { composePluginsSync } from '@nx/webpack/src/utils/config';
import { NormalizedWebpackExecutorOptions } from '@nx/webpack/src/executors/webpack/schema';
import { join } from 'path';
import {
  Configuration,
  DefinePlugin,
  ResolvePluginInstance,
  WebpackPluginInstance,
} from 'webpack';
import { mergePlugins } from './merge-plugins';
import { withReact } from '../with-react';
import { existsSync } from 'fs';

// This is shamelessly taken from CRA and modified for NX use
// https://github.com/facebook/create-react-app/blob/4784997f0682e75eb32a897b4ffe34d735912e6c/packages/react-scripts/config/env.js#L71
function getClientEnvironment(mode) {
  // Grab NODE_ENV and NX_* and STORYBOOK_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_PREFIX = /^NX_/i;
  const STORYBOOK_PREFIX = /^STORYBOOK_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_PREFIX.test(key) || STORYBOOK_PREFIX.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        NODE_ENV: process.env.NODE_ENV || mode,

        // Environment variables for Storybook
        // https://github.com/storybookjs/storybook/blob/bdf9e5ed854b8d34e737eee1a4a05add88265e92/lib/core-common/src/utils/envs.ts#L12-L21
        NODE_PATH: process.env.NODE_PATH || '',
        STORYBOOK: process.env.STORYBOOK || 'true',
        // This is to support CRA's public folder feature.
        // In production we set this to dot(.) to allow the browser to access these assets
        // even when deployed inside a subpath. (like in GitHub pages)
        // In development this is just empty as we always serves from the root.
        PUBLIC_URL: mode === 'production' ? '.' : '',
      }
    );

  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}

export const core = (prev, options) => ({
  ...prev,
  disableWebpackDefaults: true,
});

interface NxProjectData {
  workspaceRoot: string;
  projectRoot: string;
  sourceRoot: string;
  projectNode?: ProjectGraphProjectNode;
}

const getProjectData = async (
  storybookOptions: any
): Promise<NxProjectData> => {
  const fallbackData = {
    workspaceRoot: storybookOptions.configDir,
    projectRoot: '',
    sourceRoot: '',
  };
  // Edge-case: not running from Nx
  if (!process.env.NX_WORKSPACE_ROOT) return fallbackData;

  const projectGraph = await createProjectGraphAsync();
  const projectNode = projectGraph.nodes[process.env.NX_TASK_TARGET_PROJECT];

  return projectNode
    ? {
        workspaceRoot: process.env.NX_WORKSPACE_ROOT,
        projectRoot: projectNode.data.root,
        sourceRoot: projectNode.data.sourceRoot,
        projectNode,
      }
    : // Edge-case: missing project node
      fallbackData;
};

const fixBabelConfigurationIfNeeded = (
  webpackConfig: Configuration,
  projectData: NxProjectData
): void => {
  if (!projectData.projectNode) return;

  const isUsingBabelUpwardRootMode = Object.keys(
    projectData.projectNode.data.targets
  ).find((k) => {
    const targetConfig = projectData.projectNode.data.targets[k];
    return (
      (targetConfig.executor === '@nx/webpack:webpack' ||
        targetConfig.executor === '@nrwl/webpack:webpack') &&
      targetConfig.options?.babelUpwardRootMode
    );
  });

  if (isUsingBabelUpwardRootMode) return;

  let babelrcPath: string;
  for (const ext of ['', '.json', '.js', '.cjs', '.mjs', '.cts']) {
    const candidate = join(
      projectData.workspaceRoot,
      projectData.projectRoot,
      `.babelrc${ext}`
    );
    if (existsSync(candidate)) {
      babelrcPath = candidate;
      break;
    }
  }

  // Unexpected setup, skip.
  if (!babelrcPath) return;

  let babelRuleItem;
  for (const rule of webpackConfig.module.rules) {
    if (typeof rule === 'string') continue;
    if (!rule || !Array.isArray(rule.use)) continue;
    for (const item of rule.use) {
      if (typeof item !== 'string' && item['loader'].includes('babel-loader')) {
        babelRuleItem = item;
        break;
      }
    }
  }

  if (babelRuleItem) {
    babelRuleItem.options.configFile = babelrcPath;
  }
};

export const webpack = async (
  storybookWebpackConfig: Configuration = {},
  options: any
): Promise<Configuration> => {
  logger.info(
    '=> Loading Nx React Storybook Addon from "@nx/react/plugins/storybook"'
  );
  // In case anyone is missing dep and did not run migrations.
  // See: https://github.com/nrwl/nx/issues/14455
  try {
    require.resolve('@nx/webpack');
  } catch {
    throw new Error(
      `'@nx/webpack' package is not installed. Install it and try again.`
    );
  }

  const { withNx, withWeb } = require('@nx/webpack');

  const projectData = await getProjectData(options);
  const tsconfigPath = join(projectData.projectRoot, 'tsconfig.storybook.json');

  fixBabelConfigurationIfNeeded(storybookWebpackConfig, projectData);

  const builderOptions: NormalizedWebpackExecutorOptions = {
    ...options,
    root: projectData.workspaceRoot,
    projectRoot: projectData.projectRoot,
    sourceRoot: projectData.sourceRoot,
    fileReplacements: [],
    sourceMap: true,
    styles: options.styles ?? [],
    optimization: {},
    tsConfig: tsconfigPath,
    extractCss: storybookWebpackConfig.mode === 'production',
    target: 'web',
  };

  // ESM build for modern browsers.
  let baseWebpackConfig: Configuration = {};
  const configure = composePluginsSync(
    withNx({ skipTypeChecking: true }),
    withWeb(),
    withReact()
  );
  const finalConfig = configure(baseWebpackConfig, {
    options: builderOptions,
    context: { root: workspaceRoot } as ExecutorContext, // The context is not used here.
  });

  return {
    ...storybookWebpackConfig,
    module: {
      ...storybookWebpackConfig.module,
      rules: [
        ...storybookWebpackConfig.module.rules,
        ...finalConfig.module.rules,
      ],
    },
    resolve: {
      ...storybookWebpackConfig.resolve,
      fallback: {
        ...storybookWebpackConfig.resolve?.fallback,
        // Next.js and other React frameworks may have server-code that uses these modules.
        // They are not meant for client-side components so skip the fallbacks.
        assert: false,
        path: false,
        util: false,
      },
      plugins: mergePlugins(
        ...((storybookWebpackConfig.resolve.plugins ??
          []) as ResolvePluginInstance[]),
        ...((finalConfig.resolve
          .plugins as unknown as ResolvePluginInstance[]) ?? [])
      ) as ResolvePluginInstance[],
    },
    plugins: mergePlugins(
      new DefinePlugin(
        getClientEnvironment(storybookWebpackConfig.mode).stringified
      ),
      ...((storybookWebpackConfig.plugins as WebpackPluginInstance[]) ?? []),
      ...((finalConfig.plugins as WebpackPluginInstance[]) ?? [])
    ) as WebpackPluginInstance[],
  };
};
