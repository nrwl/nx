import { Compiler, RspackPluginInstance } from '@rspack/core';
import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '../../../utils/models';
import { getModuleFederationConfigSync } from '../../../with-module-federation/angular/utils';

export class NxModuleFederationPlugin implements RspackPluginInstance {
  constructor(
    private _options: {
      config: ModuleFederationConfig;
      isServer?: boolean;
    },
    private configOverride?: NxModuleFederationConfigOverride
  ) {}

  apply(compiler: Compiler) {
    if (global.NX_GRAPH_CREATION) {
      return;
    }

    // This is required to ensure Module Federation will build the project correctly
    compiler.options.optimization ??= {};
    compiler.options.optimization.runtimeChunk = false;
    compiler.options.output.publicPath = !compiler.options.output.publicPath
      ? 'auto'
      : compiler.options.output.publicPath;
    compiler.options.output.uniqueName = this._options.config.name;
    if (compiler.options.output.scriptType === 'module') {
      compiler.options.output.scriptType = undefined;
      compiler.options.output.module = undefined;
    }
    if (this._options.isServer) {
      compiler.options.target = 'async-node';
      compiler.options.output.library ??= {
        type: 'commonjs-module',
      };
      compiler.options.output.library.type = 'commonjs-module';
    }

    const config = getModuleFederationConfigSync(
      this._options.config,
      {
        isServer: this._options.isServer,
      },
      true
    );
    const sharedLibraries = config.sharedLibraries;
    const sharedDependencies = config.sharedDependencies;
    const mappedRemotes = config.mappedRemotes;

    const runtimePlugins = [];
    if (this.configOverride?.runtimePlugins) {
      runtimePlugins.push(...(this.configOverride.runtimePlugins ?? []));
    }
    if (this._options.isServer) {
      runtimePlugins.push(
        require.resolve('@module-federation/node/runtimePlugin')
      );
    }

    new (require('@module-federation/enhanced/rspack').ModuleFederationPlugin)({
      name: this._options.config.name.replace(/-/g, '_'),
      filename: 'remoteEntry.js',
      exposes: this._options.config.exposes,
      remotes: mappedRemotes,
      shared: {
        ...(sharedDependencies ?? {}),
      },
      ...(this._options.isServer
        ? {
            library: {
              type: 'commonjs-module',
            },
            remoteType: 'script',
          }
        : {}),
      ...(this.configOverride ? this.configOverride : {}),
      runtimePlugins,
      virtualRuntimeEntry: true,
    }).apply(compiler);

    if (sharedLibraries) {
      sharedLibraries.getReplacementPlugin().apply(compiler as any);
    }
  }
}
