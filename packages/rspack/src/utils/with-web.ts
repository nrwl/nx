import { Configuration } from '@rspack/core';
import { ExtraEntryPointClass } from './model';
import { applyWebConfig } from '../plugins/utils/apply-web-config';
import { NxRspackExecutionContext } from './config';

export interface WithWebOptions {
  baseHref?: string;
  deployUrl?: string;
  extractCss?: boolean;
  generateIndexHtml?: boolean;
  index?: string;
  postcssConfig?: string;
  scripts?: Array<ExtraEntryPointClass | string>;
  styles?: Array<ExtraEntryPointClass | string>;
  stylePreprocessorOptions?: {
    includePaths?: string[];
  };
  cssModules?: boolean;
  ssr?: boolean;
}

const processed = new Set();

export function withWeb(pluginOptions: WithWebOptions = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: NxRspackExecutionContext
  ): Configuration {
    if (processed.has(config)) {
      return config;
    }

    applyWebConfig(
      {
        ...options,
        ...pluginOptions,
        root: context.root,
        projectName: context.projectName,
        targetName: context.targetName,
        configurationName: context.configurationName,
        projectGraph: context.projectGraph,
      },
      config
    );

    processed.add(config);
    return config;
  };
}

function getClientEnvironment(mode?: string) {
  // Grab NODE_ENV and NX_PUBLIC_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in rspack configuration.
  const nxPublicKeyRegex = /^NX_PUBLIC_/i;

  const raw = Object.keys(process.env)
    .filter((key) => nxPublicKeyRegex.test(key))
    .reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});

  // Stringify all values so we can feed into rspack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}
