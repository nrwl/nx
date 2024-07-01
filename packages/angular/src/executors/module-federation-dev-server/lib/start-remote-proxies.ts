import { logger } from '@nx/devkit';
import type { StaticRemotesConfig } from './parse-static-remotes-config';
import type { Express } from 'express';

export function startRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
  mappedLocationsOfRemotes: Record<string, string>
) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  const express = require('express');
  logger.info(`NX Starting static remotes proxies...`);
  for (const app of staticRemotesConfig.remotes) {
    const expressProxy: Express = express();
    expressProxy.use(
      createProxyMiddleware({
        target: mappedLocationsOfRemotes[app],
        changeOrigin: true,
      })
    );
    const proxyServer = expressProxy.listen(
      staticRemotesConfig.config[app].port
    );
    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
  }
  logger.info(`NX Static remotes proxies started successfully`);
}
