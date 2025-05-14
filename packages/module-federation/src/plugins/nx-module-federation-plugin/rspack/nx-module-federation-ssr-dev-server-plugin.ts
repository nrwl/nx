import {
  Compilation,
  Compiler,
  DefinePlugin,
  RspackPluginInstance,
} from '@rspack/core';
import * as pc from 'picocolors';
import {
  logger,
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { ModuleFederationConfig } from '../../../utils/models';
import { dirname, extname, join } from 'path';
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
import { ChildProcess, fork } from 'node:child_process';

const PLUGIN_NAME = 'NxModuleFederationSSRDevServerPlugin';

export class NxModuleFederationSSRDevServerPlugin
  implements RspackPluginInstance
{
  private devServerProcess: ChildProcess | undefined;
  private nxBin = require.resolve('nx/bin/nx');

  constructor(
    private _options: {
      config: ModuleFederationConfig;
      devServerConfig?: NxModuleFederationDevServerConfig;
    }
  ) {
    this._options.devServerConfig ??= {
      host: 'localhost',
    };
  }

  apply(compiler: Compiler) {
    const isDevServer = process.env['WEBPACK_SERVE'];
    if (!isDevServer) {
      return;
    }
    compiler.hooks.watchRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        compiler.hooks.beforeCompile.tapAsync(
          PLUGIN_NAME,
          async (params, callback) => {
            const staticRemotesConfig = await this.setup(compiler);

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
            startRemoteProxies(
              staticRemotesConfig,
              mappedLocationOfRemotes,
              {
                pathToCert: this._options.devServerConfig.sslCert,
                pathToKey: this._options.devServerConfig.sslCert,
              },
              true
            );

            new DefinePlugin({
              'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
            }).apply(compiler);

            await this.startServer(compiler);

            callback();
          }
        );
        callback();
      }
    );
  }

  private async startServer(compiler: Compiler) {
    compiler.hooks.done.tapAsync(PLUGIN_NAME, async (_, callback) => {
      const serverPath = join(
        compiler.options.output.path,
        (compiler.options.output.filename as string) ?? 'server.js'
      );
      if (this.devServerProcess) {
        await new Promise<void>((res) => {
          this.devServerProcess.on('exit', () => {
            res();
          });
          this.devServerProcess.kill('SIGKILL');
          this.devServerProcess = undefined;
        });
      }

      if (!existsSync(serverPath)) {
        for (let retries = 0; retries < 10; retries++) {
          await new Promise<void>((res) => setTimeout(res, 200));
          if (existsSync(serverPath)) {
            break;
          }
        }
        if (!existsSync(serverPath)) {
          throw new Error(`Could not find server bundle at ${serverPath}.`);
        }
      }

      this.devServerProcess = fork(serverPath);
      process.on('exit', () => {
        this.devServerProcess?.kill('SIGKILL');
      });
      process.on('SIGINT', () => {
        this.devServerProcess?.kill('SIGKILL');
      });
      callback();
    });
  }

  private async setup(compiler: Compiler) {
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
      projectGraph,
      true
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
