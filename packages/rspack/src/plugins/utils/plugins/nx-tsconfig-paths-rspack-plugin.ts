import * as path from 'path';
import type {
  Compiler,
  Configuration,
  RspackOptionsNormalized,
} from '@rspack/core';
import { workspaceRoot } from '@nx/devkit';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/internal';
import { NormalizedNxAppRspackPluginOptions } from '../models';
import { RspackNxBuildCoordinationPlugin } from './rspack-nx-build-coordination-plugin';
import { unlinkSync } from 'fs';

export class NxTsconfigPathsRspackPlugin {
  private tmpTsConfigPath?: string;

  constructor(private options: NormalizedNxAppRspackPluginOptions) {
    this.getTsConfig();
  }

  private getTsConfig(): string {
    if (!this.options.tsConfig)
      throw new Error(
        `Missing "tsConfig" option. Set this option in your Nx rspack plugin.`
      );
    return this.options.tsConfig;
  }

  apply(compiler: Compiler): void {
    // TODO(Colum): Investigate the best way to handle this, currently it is not working and affecting HMR
    // // If we are not building libs from source, we need to remap paths so tsconfig may be updated.
    this.handleBuildLibsFromSource(compiler.options, this.options);

    const tsConfig = this.getTsConfig();
    const pathToTsconfig = !path.isAbsolute(tsConfig)
      ? path.join(workspaceRoot, tsConfig)
      : tsConfig;

    const extensions = new Set([
      ...['.ts', '.tsx', '.mjs', '.js', '.jsx'],
      ...(compiler.options?.resolve?.extensions ?? []),
    ]);

    compiler.options.resolve = {
      ...compiler.options.resolve,
      extensions: [...extensions],
      tsConfig: { configFile: pathToTsconfig },
    };
  }

  cleanupTmpTsConfigFile() {
    if (this.tmpTsConfigPath) {
      try {
        if (this.tmpTsConfigPath) {
          unlinkSync(this.tmpTsConfigPath);
        }
      } catch (e) {}
    }
  }

  handleBuildLibsFromSource(
    config: Partial<RspackOptionsNormalized | Configuration>,
    options: NormalizedNxAppRspackPluginOptions
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
        this.getTsConfig(),
        options.root,
        target.data.root,
        dependencies
      );
      this.tmpTsConfigPath = options.tsConfig;

      if (options.targetName === 'serve') {
        const buildableDependencies = dependencies
          .filter((dependency) => dependency.node.type === 'lib')
          .map((dependency) => dependency.node.name)
          .join(',');

        const buildCommand = `nx run-many --target=build --projects=${buildableDependencies}`;

        if (buildableDependencies && buildableDependencies.length > 0) {
          config.plugins ??= [];
          config.plugins.push(
            new RspackNxBuildCoordinationPlugin(buildCommand)
          );
        }
      }
    }
  }
}
