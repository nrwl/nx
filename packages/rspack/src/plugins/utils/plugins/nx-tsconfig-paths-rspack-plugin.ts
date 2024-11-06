import * as path from 'path';
import {
  Compiler,
  type Configuration,
  type RspackOptionsNormalized,
} from '@rspack/core';
import { workspaceRoot } from '@nx/devkit';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import { NormalizedNxAppRspackPluginOptions } from '../models';
import { RspackNxBuildCoordinationPlugin } from './rspack-nx-build-coordination-plugin';

export class NxTsconfigPathsRspackPlugin {
  constructor(private options: NormalizedNxAppRspackPluginOptions) {
    if (!this.options.tsConfig)
      throw new Error(
        `Missing "tsConfig" option. Set this option in your Nx webpack plugin.`
      );
  }

  apply(compiler: Compiler): void {
    // If we are not building libs from source, we need to remap paths so tsconfig may be updated.
    this.handleBuildLibsFromSource(compiler.options, this.options);

    const pathToTsconfig = !path.isAbsolute(this.options.tsConfig)
      ? path.join(workspaceRoot, this.options.tsConfig)
      : this.options.tsConfig;

    const extensions = new Set([
      ...['.ts', '.tsx', '.mjs', '.js', '.jsx'],
      ...(compiler.options?.resolve?.extensions ?? []),
    ]);

    compiler.options.resolve = {
      ...compiler.options.resolve,
      extensions: [...extensions],
      tsConfig: pathToTsconfig,
    };
  }

  handleBuildLibsFromSource(
    config: Partial<RspackOptionsNormalized | Configuration>,
    options
  ): void {
    if (!options.buildLibsFromSource && options.targetName) {
      const remappedTarget =
        options.targetName === 'serve' ? 'build' : options.targetName;

      const { target, dependencies } = calculateProjectBuildableDependencies(
        undefined,
        options.projectGraph,
        options.root,
        options.projectName,
        remappedTarget,
        options.configurationName
      );
      options.tsConfig = createTmpTsConfig(
        options.tsConfig,
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

        config.plugins.push(new RspackNxBuildCoordinationPlugin(buildCommand));
      }
    }
  }
}
