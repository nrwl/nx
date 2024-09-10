import { logger } from '@nx/devkit';
import type { Express } from 'express';
import { existsSync, readFileSync } from 'fs';
import { StaticRemotesConfig } from './parse-static-remotes-config';

export function startRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: { pathToCert: string; pathToKey: string }
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createProxyMiddleware } = require('http-proxy-middleware');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
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

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const http: typeof import('http') = require('http');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const https: typeof import('https') = require('https');

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
    const proxyServer = (
      sslCert
        ? https.createServer(
            {
              cert: sslCert,
              key: sslKey,
            },
            expressProxy
          )
        : http.createServer(expressProxy)
    ).listen(staticRemotesConfig.config[app].port);
    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
  }
  logger.info(`NX Static remotes proxies started successfully`);
}
