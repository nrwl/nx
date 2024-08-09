import type { Express } from 'express';
import { logger } from '@nx/devkit';
import type { StaticRemotesConfig } from './parse-static-remotes-config';

export function startSsrRemoteProxies(
  staticRemotesConfig: StaticRemotesConfig,
  mappedLocationsOfRemotes: Record<string, string>
) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  logger.info(`NX Starting static remotes proxies...`);
  const express = require('express');
  const expressProxy: Express = express();
  for (const app of staticRemotesConfig.remotes) {
    /**
     * SSR remotes have two output paths: one for the browser and one for the server.
     * We need to handle paths for both of them.
     * The browser output path is used to serve the client-side code.
     * The server output path is used to serve the server-side code.
     */

    expressProxy.use(
      createProxyMiddleware({
        target: `${mappedLocationsOfRemotes[app]}`,
        changeOrigin: true,
        pathRewrite: (path) => {
          console.log(path);
          if (path.includes('/server')) {
            return path;
          } else {
            return `browser/${path}`;
          }
        },
      })
    );

    const proxyServer = expressProxy.listen(
      staticRemotesConfig.config[app].port
    );
    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
  }
  logger.info(`Nx SSR Static remotes proxies started successfully`);
}
