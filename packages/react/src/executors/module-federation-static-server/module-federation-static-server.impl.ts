import { ModuleFederationStaticServerSchema } from './schema';
import { ModuleFederationDevServerOptions } from '../module-federation-dev-server/schema';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { basename, extname, join } from 'path';
import {
  logger,
  parseTargetString,
  readTargetOptions,
  Target,
  workspaceRoot,
} from '@nx/devkit';
import { cpSync, existsSync, readFileSync, rmSync } from 'fs';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import {
  parseStaticRemotesConfig,
  StaticRemotesConfig,
} from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';
import { buildStaticRemotes } from '../../utils/build-static.remotes';
import { fork } from 'child_process';
import type { WebpackExecutorOptions } from '@nx/webpack';
import * as process from 'node:process';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import type { Express } from 'express';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';

function getBuildAndServeOptionsFromServeTarget(
  serveTarget: string,
  context: ExecutorContext
) {
  const target = parseTargetString(serveTarget, context);

  const serveOptions: ModuleFederationDevServerOptions = readTargetOptions(
    target,
    context
  );
  const buildTarget = parseTargetString(serveOptions.buildTarget, context);

  const buildOptions: WebpackExecutorOptions = readTargetOptions(
    buildTarget,
    context
  );

  let pathToManifestFile = join(
    context.root,
    context.projectGraph.nodes[context.projectName].data.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (serveOptions.pathToManifestFile) {
    const userPathToManifestFile = join(
      context.root,
      serveOptions.pathToManifestFile
    );
    if (!existsSync(userPathToManifestFile)) {
      throw new Error(
        `The provided Module Federation manifest file path does not exist. Please check the file exists at "${userPathToManifestFile}".`
      );
    } else if (extname(serveOptions.pathToManifestFile) !== '.json') {
      throw new Error(
        `The Module Federation manifest file must be a JSON. Please ensure the file at ${userPathToManifestFile} is a JSON.`
      );
    }

    pathToManifestFile = userPathToManifestFile;
  }

  return {
    buildTarget,
    buildOptions,
    serveOptions,
    pathToManifestFile,
  };
}

async function buildHost(
  nxBin: string,
  buildTarget: Target,
  context: ExecutorContext
) {
  await new Promise<void>((res, rej) => {
    const staticProcess = fork(
      nxBin,
      [
        `run`,
        `${buildTarget.project}:${buildTarget.target}${
          buildTarget.configuration
            ? `:${buildTarget.configuration}`
            : context.configurationName
            ? `:${context.configurationName}`
            : ''
        }`,
      ],
      {
        cwd: context.root,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    staticProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');

      // in addition to writing into the stdout stream, also show error directly in console
      // so the error is easily discoverable. 'ERROR in' is the key word to search in webpack output.
      if (stdoutString.includes('ERROR in')) {
        logger.log(stdoutString);
      }

      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout.removeAllListeners('data');
        logger.info(`NX Built host`);
        res();
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.once('exit', (code) => {
      staticProcess.stdout.removeAllListeners('data');
      staticProcess.stderr.removeAllListeners('data');
      if (code !== 0) {
        rej(`Host failed to build. See above for details.`);
      } else {
        res();
      }
    });

    process.on('SIGTERM', () => staticProcess.kill('SIGTERM'));
    process.on('exit', () => staticProcess.kill('SIGTERM'));
  });
}

function moveToTmpDirectory(
  staticRemotesConfig: StaticRemotesConfig,
  hostOutputPath: string,
  hostUrlSegment: string
) {
  const commonOutputDirectory = join(
    workspaceRoot,
    'tmp/static-module-federation'
  );
  for (const app of staticRemotesConfig.remotes) {
    const remoteConfig = staticRemotesConfig.config[app];
    cpSync(
      remoteConfig.outputPath,
      join(commonOutputDirectory, remoteConfig.urlSegment),
      {
        force: true,
        recursive: true,
      }
    );
  }
  cpSync(hostOutputPath, join(commonOutputDirectory, hostUrlSegment), {
    force: true,
    recursive: true,
  });

  const cleanup = () => {
    rmSync(commonOutputDirectory, { force: true, recursive: true });
  };
  process.on('SIGTERM', () => {
    cleanup();
  });
  process.on('exit', () => {
    cleanup();
  });

  return commonOutputDirectory;
}

export function startProxies(
  staticRemotesConfig: StaticRemotesConfig,
  hostServeOptions: ModuleFederationDevServerOptions,
  mappedLocationOfHost: string,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: { pathToCert: string; pathToKey: string }
) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  const express = require('express');
  let sslCert: Buffer;
  let sslKey: Buffer;
  if (sslOptions && sslOptions.pathToCert && sslOptions.pathToKey) {
    if (existsSync(sslOptions.pathToCert) && existsSync(sslOptions.pathToKey)) {
      sslCert = readFileSync(sslOptions.pathToCert);
      sslKey = readFileSync(sslOptions.pathToKey);
    } else {
      logger.warn(
        `Encountered SSL options in project.json, however, the certificate files do not exist in the filesystem. Using http.`
      );
      logger.warn(
        `Attempted to find '${sslOptions.pathToCert}' and '${sslOptions.pathToKey}'.`
      );
    }
  }
  const http = require('http');
  const https = require('https');

  logger.info(`NX Starting static remotes proxies...`);
  for (const app of staticRemotesConfig.remotes) {
    const expressProxy: Express = express();
    expressProxy.use(
      createProxyMiddleware({
        target: mappedLocationsOfRemotes[app],
        changeOrigin: true,
        secure: sslCert ? false : undefined,
      })
    );
    const proxyServer = (sslCert ? https : http)
      .createServer({ cert: sslCert, key: sslKey }, expressProxy)
      .listen(staticRemotesConfig.config[app].port);
    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
  }
  logger.info(`NX Static remotes proxies started successfully`);
  logger.info(`NX Starting static host proxy...`);
  const expressProxy: Express = express();
  expressProxy.use(
    createProxyMiddleware({
      target: mappedLocationOfHost,
      changeOrigin: true,
      secure: sslCert ? false : undefined,
      pathRewrite: (path) => {
        let pathRewrite = path;
        for (const app of staticRemotesConfig.remotes) {
          if (path.endsWith(app)) {
            pathRewrite = '/';
            break;
          }
        }
        return pathRewrite;
      },
    })
  );
  const proxyServer = (sslCert ? https : http)
    .createServer({ cert: sslCert, key: sslKey }, expressProxy)
    .listen(hostServeOptions.port);
  process.on('SIGTERM', () => proxyServer.close());
  process.on('exit', () => proxyServer.close());
  logger.info('NX Static host proxy started successfully');
}

export default async function* moduleFederationStaticServer(
  schema: ModuleFederationStaticServerSchema,
  context: ExecutorContext
) {
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');

  // Get the remotes from the module federation config
  const p = context.projectsConfigurations.projects[context.projectName];
  const options = getBuildAndServeOptionsFromServeTarget(
    schema.serveTarget,
    context
  );

  const moduleFederationConfig = getModuleFederationConfig(
    options.buildOptions.tsConfig,
    context.root,
    p.root,
    'react'
  );

  const remotes = getRemotes(
    [],
    options.serveOptions.skipRemotes,
    moduleFederationConfig,
    {
      projectName: context.projectName,
      projectGraph: context.projectGraph,
      root: context.root,
    },
    options.pathToManifestFile
  );

  const staticRemotesConfig = parseStaticRemotesConfig(
    [...remotes.staticRemotes, ...remotes.dynamicRemotes],
    context
  );

  options.serveOptions.staticRemotesPort ??= remotes.staticRemotePort;
  const mappedLocationsOfStaticRemotes = await buildStaticRemotes(
    staticRemotesConfig,
    nxBin,
    context,
    options.serveOptions
  );

  // Build the host
  const hostUrlSegment = basename(options.buildOptions.outputPath);
  const mappedLocationOfHost = `http${options.serveOptions.ssl ? 's' : ''}://${
    options.serveOptions.host
  }:${options.serveOptions.staticRemotesPort}/${hostUrlSegment}`;
  await buildHost(nxBin, options.buildTarget, context);

  // Move to a temporary directory
  const commonOutputDirectory = moveToTmpDirectory(
    staticRemotesConfig,
    options.buildOptions.outputPath,
    hostUrlSegment
  );

  // File Serve the temporary directory
  const staticFileServerIter = fileServerExecutor(
    {
      cors: true,
      watch: false,
      staticFilePath: commonOutputDirectory,
      parallel: false,
      spa: false,
      withDeps: false,
      host: options.serveOptions.host,
      port: options.serveOptions.staticRemotesPort,
      ssl: options.serveOptions.ssl,
      sslCert: options.serveOptions.sslCert,
      sslKey: options.serveOptions.sslKey,
      cacheSeconds: -1,
    },
    context
  );

  // express proxy all of it
  startProxies(
    staticRemotesConfig,
    options.serveOptions,
    mappedLocationOfHost,
    mappedLocationsOfStaticRemotes,
    options.serveOptions.ssl
      ? {
          pathToCert: join(workspaceRoot, options.serveOptions.sslCert),
          pathToKey: join(workspaceRoot, options.serveOptions.sslKey),
        }
      : undefined
  );

  return yield* combineAsyncIterables(
    staticFileServerIter,
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        const host = options.serveOptions.host ?? 'localhost';
        const baseUrl = `http${options.serveOptions.ssl ? 's' : ''}://${host}:${
          options.serveOptions.port
        }`;

        if (remotes.remotePorts.length === 0) {
          const portsToWaitFor = [options.serveOptions.staticRemotesPort];
          await Promise.all(
            portsToWaitFor.map((port) =>
              waitForPortOpen(port, {
                retries: 480,
                retryDelay: 2500,
                host: host,
              })
            )
          );

          logger.info(`NX Server ready at ${baseUrl}`);
          next({ success: true, baseUrl: baseUrl });
          done();
          return;
        }

        try {
          const portsToWaitFor = staticFileServerIter
            ? [options.serveOptions.staticRemotesPort, ...remotes.remotePorts]
            : [...remotes.remotePorts];
          await Promise.all(
            portsToWaitFor.map((port) =>
              waitForPortOpen(port, {
                retries: 480,
                retryDelay: 2500,
                host: host,
              })
            )
          );

          logger.info(`NX Server ready at ${baseUrl}`);
          next({ success: true, baseUrl: baseUrl });
        } catch (err) {
          throw new Error(`Failed to start. Check above for any errors.`, {
            cause: err,
          });
        } finally {
          done();
        }
      }
    )
  );
}
