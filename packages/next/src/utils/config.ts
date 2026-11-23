import type { NextConfig } from 'next';
import { resolve } from 'path';
import { Configuration } from 'webpack';
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

interface WebpackConfigContext {
  buildId: string;
  dev: boolean;
  isServer: boolean;
}

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = [],
  assets: any = null
): (config: Configuration, context: WebpackConfigContext) => Configuration {
  return function webpackConfig(
    config: Configuration,
    { isServer }: WebpackConfigContext
  ): Configuration {
    const alias = config.resolve?.alias;
    for (const fileReplacement of fileReplacements) {
      if (!alias || Array.isArray(alias)) {
        throw new Error('Expected the webpack config to define resolve.alias.');
      }
      alias[resolve(workspaceRoot, fileReplacement.replace)] = resolve(
        workspaceRoot,
        fileReplacement.with
      );
    }

    // Copy (shared) assets to `public` folder during client-side compilation
    if (!isServer && Array.isArray(assets) && assets.length > 0) {
      (config.plugins ??= []).push(
        createCopyPlugin(assets, workspaceRoot, projectRoot)
      );
    }

    return config;
  };
}
