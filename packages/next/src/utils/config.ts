import type { NextConfig } from 'next';
import { resolve } from 'path';
import { Configuration, RuleSetRule } from 'webpack';
import { FileReplacement } from './types';
import { createCopyPlugin } from './create-copy-plugin';

export interface NextConfigFn {
  (phase: string, context?: any): Promise<NextConfig> | NextConfig;
}

export interface NextPlugin {
  (config: NextConfig): NextConfig;
}

export interface NextPluginThatReturnsConfigFn {
  (config: NextConfig): NextConfigFn;
}

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = [],
  assets: any = null
): (a, b) => Configuration {
  return function webpackConfig(
    config: Configuration,
    {
      isServer,
    }: {
      buildId: string;
      dev: boolean;
      isServer: boolean;
    }
  ): Configuration {
    fileReplacements
      .map((fileReplacement) => ({
        replace: resolve(workspaceRoot, fileReplacement.replace),
        with: resolve(workspaceRoot, fileReplacement.with),
      }))
      .reduce((alias, replacement) => {
        alias[replacement.replace] = replacement.with;
        return alias;
      }, config.resolve.alias);

    // Copy (shared) assets to `public` folder during client-side compilation
    if (!isServer && Array.isArray(assets) && assets.length > 0) {
      config.plugins.push(createCopyPlugin(assets, workspaceRoot, projectRoot));
    }

    return config;
  };
}
