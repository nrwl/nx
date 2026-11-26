import * as path from 'path';
import type {
  Compiler,
  Configuration,
  WebpackOptionsNormalized,
} from 'webpack';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { workspaceRoot } from '@nx/devkit';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/internal';
import { resolvePathsBaseUrl } from '@nx/js';
import { ApplyConfigOptions } from '../nx-webpack-plugin/nx-app-webpack-plugin-options';
import { WebpackNxBuildCoordinationPlugin } from '../webpack-nx-build-coordination-plugin';

function requireTsConfig(options: ApplyConfigOptions): string {
  if (!options.tsConfig) {
    throw new Error(
      `Missing "tsConfig" option. Set this option in your Nx webpack plugin.`
    );
  }
  return options.tsConfig;
}

export class NxTsconfigPathsWebpackPlugin {
  constructor(private options: ApplyConfigOptions) {
    requireTsConfig(this.options);
  }

  apply(compiler: Compiler): void {
    // If we are not building libs from source, we need to remap paths so tsconfig may be updated.
    this.handleBuildLibsFromSource(compiler.options, this.options);

    const extensions = new Set([
      ...['.ts', '.tsx', '.mjs', '.js', '.jsx'],
      ...(compiler.options?.resolve?.extensions ?? []),
    ]);
    const resolvePlugins = compiler.options.resolve?.plugins ?? [];
    compiler.options.resolve = {
      ...compiler.options.resolve,
      plugins: resolvePlugins,
    };
    const tsConfig = requireTsConfig(this.options);
    const configFile = !path.isAbsolute(tsConfig)
      ? path.join(workspaceRoot, tsConfig)
      : tsConfig;
    resolvePlugins.push(
      new TsconfigPathsPlugin({
        configFile,
        baseUrl: resolvePathsBaseUrl(configFile),
        extensions: Array.from(extensions),
        mainFields: ['module', 'main'],
      })
    );
  }

  handleBuildLibsFromSource(
    config: Partial<WebpackOptionsNormalized | Configuration>,
    options: ApplyConfigOptions
  ): void {
    const { targetName, projectGraph, projectName } = options;
    if (!options.buildLibsFromSource && targetName) {
      if (!projectGraph || !projectName) {
        throw new Error(
          'Resolving buildable libraries requires a project graph and project name.'
        );
      }
      const remappedTarget = targetName === 'serve' ? 'build' : targetName;

      const { target, dependencies } = calculateProjectBuildableDependencies(
        undefined,
        projectGraph,
        options.root,
        projectName,
        remappedTarget,
        options.configurationName
      );
      options.tsConfig = createTmpTsConfig(
        requireTsConfig(options),
        options.root,
        target.data.root,
        dependencies
      );

      if (options.targetName === 'serve') {
        const buildableDependencies = dependencies
          .filter((dependency) => dependency.node.type === 'lib')
          .map((dependency) => dependency.node.name)
          .join(',');

        const buildCommand = `nx run-many --target=build --projects=${buildableDependencies}`;

        if (!config.plugins) {
          throw new Error('Expected the webpack config to have plugins.');
        }
        config.plugins.push(
          new WebpackNxBuildCoordinationPlugin(buildCommand, {
            skipWatchingDeps: options.watchDependencies === false,
          })
        );
      }
    }
  }
}
