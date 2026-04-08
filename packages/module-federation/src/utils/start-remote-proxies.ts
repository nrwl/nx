import type { Express } from 'express';
import { logger } from '@nx/devkit';
import { StaticRemotesConfig } from './parse-static-remotes-config';
import { existsSync, readFileSync } from 'fs';
import { isPortInUse } from './port-utils';

export async function startRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: { pathToCert: string; pathToKey: string },
  host: string = '127.0.0.1'
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
  let startedProxies = 0;
  let skippedProxies = 0;

  for (const app of staticRemotesConfig.remotes) {
    const port = staticRemotesConfig.config[app].port;

    // Check if the port is already in use (another MF dev server may have already started a proxy)
    const portInUse = await isPortInUse(port, host);
    if (portInUse) {
      logger.info(
        `NX Skipping proxy for ${app} on port ${port} - port already in use (likely served by another process)`
      );
      skippedProxies++;
      continue;
    }

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
      .listen(port);
    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
    startedProxies++;
  }

  if (skippedProxies > 0) {
    logger.info(
      `NX Static remotes proxies: started ${startedProxies}, skipped ${skippedProxies} (already running)`
    );
  } else {
    logger.info(`NX Static remotes proxies started successfully`);
  }
}
