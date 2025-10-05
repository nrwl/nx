import type { Express } from 'express';
import { logger } from '@nx/devkit';
import { StaticRemotesConfig } from './parse-static-remotes-config';
import { existsSync, readFileSync } from 'fs';

export function startRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
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
}
