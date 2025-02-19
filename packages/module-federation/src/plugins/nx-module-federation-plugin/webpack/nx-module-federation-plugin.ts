import { Compiler, WebpackPluginInstance } from 'webpack';
import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '../../../utils/models';
import { getModuleFederationConfig } from '../../../with-module-federation/rspack/utils';
import { NxModuleFederationDevServerConfig } from '../../models';
import { NxModuleFederationDevServerPlugin } from './nx-module-federation-dev-server-plugin';

export class NxModuleFederationPlugin implements WebpackPluginInstance {
  constructor(
    private _options: {
      config: ModuleFederationConfig;
      devServerConfig?: NxModuleFederationDevServerConfig;
    },
    private configOverride?: NxModuleFederationConfigOverride
  ) {}

  apply(compiler: Compiler) {
    if (global.NX_GRAPH_CREATION) {
      return;
    }

    // This is required to ensure Module Federation will build the project correctly
    compiler.options.optimization.runtimeChunk = false;

    const isDevServer = !!process.env['WEBPACK_SERVE'];

    // TODO(colum): Add support for SSR
    const config = getModuleFederationConfig(this._options.config);
    const sharedLibraries = config.sharedLibraries;
    const sharedDependencies = config.sharedDependencies;
    const mappedRemotes = config.mappedRemotes;

    new (require('@module-federation/enhanced/webpack').ModuleFederationPlugin)(
      {
        name: this._options.config.name.replace(/-/g, '_'),
        filename: 'remoteEntry.js',
        exposes: this._options.config.exposes,
        remotes: mappedRemotes,
        shared: {
          ...(sharedDependencies ?? {}),
        },
        ...(this.configOverride ? this.configOverride : {}),
        runtimePlugins: this.configOverride
          ? this.configOverride.runtimePlugins ?? []
          : [],
        virtualRuntimeEntry: true,
      }
    ).apply(compiler);

    if (sharedLibraries) {
      sharedLibraries.getReplacementPlugin().apply(compiler as any);
    }

    if (isDevServer) {
      new NxModuleFederationDevServerPlugin({
        config: this._options.config,
        devServerConfig: {
          ...(this._options.devServerConfig ?? {}),
          host: this._options.devServerConfig?.host ?? 'localhost',
        },
      }).apply(compiler);
    }
  }
}
