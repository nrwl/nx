import {
  Compilation,
  Compiler,
  DefinePlugin,
  WebpackPluginInstance,
} from 'webpack';
import * as pc from 'picocolors';
import {
  logger,
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { ModuleFederationConfig } from '../../../utils/models';
import { extname, join } from 'path';
import { existsSync } from 'fs';
import {
  buildStaticRemotes,
  getDynamicMfManifestFile,
  getRemotes,
  getStaticRemotes,
  parseRemotesConfig,
  startRemoteProxies,
  startStaticRemotesFileServer,
} from '../../utils';
import { NxModuleFederationDevServerConfig } from '../../models';

const PLUGIN_NAME = 'NxModuleFederationDevServerPlugin';

export class NxModuleFederationDevServerPlugin
  implements WebpackPluginInstance
{
  private nxBin = require.resolve('nx/bin/nx');

  constructor(
    private _options: {
      config: ModuleFederationConfig;
      devServerConfig: NxModuleFederationDevServerConfig;
    }
  ) {}

  apply(compiler: Compiler) {
    compiler.hooks.beforeCompile.tapAsync(
      PLUGIN_NAME,
      async (params, callback) => {
        const staticRemotesConfig = await this.setup();

        logger.info(
          `NX Starting module federation dev-server for ${pc.bold(
            this._options.config.name
          )} with ${Object.keys(staticRemotesConfig).length} remotes`
        );

        const mappedLocationOfRemotes = await buildStaticRemotes(
          staticRemotesConfig,
          this._options.devServerConfig,
          this.nxBin
        );
        startStaticRemotesFileServer(
          staticRemotesConfig,
          workspaceRoot,
          this._options.devServerConfig.staticRemotesPort
        );
        startRemoteProxies(staticRemotesConfig, mappedLocationOfRemotes, {
          pathToCert: this._options.devServerConfig.sslCert,
          pathToKey: this._options.devServerConfig.sslCert,
        });

        new DefinePlugin({
          'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
        }).apply(compiler);
        callback();
      }
    );
  }

  private async setup() {
    const projectGraph = readCachedProjectGraph();
    const { projects: workspaceProjects } =
      readProjectsConfigurationFromProjectGraph(projectGraph);
    const project = workspaceProjects[this._options.config.name];
    if (!this._options.devServerConfig.pathToManifestFile) {
      this._options.devServerConfig.pathToManifestFile =
        getDynamicMfManifestFile(project, workspaceRoot);
    } else {
      const userPathToManifestFile = join(
        workspaceRoot,
        this._options.devServerConfig.pathToManifestFile
      );
      if (!existsSync(userPathToManifestFile)) {
        throw new Error(
          `The provided Module Federation manifest file path does not exist. Please check the file exists at "${userPathToManifestFile}".`
        );
      } else if (
        extname(this._options.devServerConfig.pathToManifestFile) !== '.json'
      ) {
        throw new Error(
          `The Module Federation manifest file must be a JSON. Please ensure the file at ${userPathToManifestFile} is a JSON.`
        );
      }

      this._options.devServerConfig.pathToManifestFile = userPathToManifestFile;
    }

    const { remotes, staticRemotePort } = getRemotes(
      this._options.config,
      projectGraph,
      this._options.devServerConfig.pathToManifestFile
    );
    this._options.devServerConfig.staticRemotesPort ??= staticRemotePort;

    const remotesConfig = parseRemotesConfig(
      remotes,
      workspaceRoot,
      projectGraph
    );
    const staticRemotesConfig = await getStaticRemotes(
      remotesConfig.config ?? {}
    );
    const devRemotes = remotes.filter((r) => !staticRemotesConfig[r]);
    process.env.NX_MF_DEV_REMOTES = JSON.stringify([
      ...(devRemotes.length > 0 ? devRemotes : []),
      project.name,
    ]);
    return staticRemotesConfig ?? {};
  }
}
