import type { Express } from 'express';
import { logger } from '@nx/devkit';
import { existsSync, readFileSync } from 'fs';

export interface ProxyServerOptions {
  /** SSL certificate and key paths */
  sslOptions?: {
    pathToCert: string;
    pathToKey: string;
  };
  /** Whether to apply SSR path rewriting */
  isServer?: boolean;
  /** Custom log prefix (default: 'NX') */
  logPrefix?: string;
}

export interface RemoteProxyConfig {
  /** Target URL for the proxy */
  target: string;
  /** Port to listen on */
  port: number;
}

/**
 * Creates and starts proxy servers for static remotes.
 * This is a shared utility used by both regular and SSR remote proxies.
 *
 * @param remotes - Map of remote names to their proxy configurations
 * @param options - Proxy server options
 */
export function createRemoteProxyServers(
  remotes: Record<string, RemoteProxyConfig>,
  options: ProxyServerOptions = {}
): void {
  const { sslOptions, isServer = false, logPrefix = 'NX' } = options;

  const { createProxyMiddleware } = require('http-proxy-middleware');
  const express = require('express');
  const http = require('http');
  const https = require('https');

  // Load SSL certificates if provided
  let sslCert: Buffer | undefined;
  let sslKey: Buffer | undefined;
  if (sslOptions?.pathToCert && sslOptions?.pathToKey) {
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

  logger.info(`${logPrefix} Starting static remotes proxies...`);

  for (const [app, config] of Object.entries(remotes)) {
    const expressProxy: Express = express();

    expressProxy.use(
      createProxyMiddleware({
        target: config.target,
        changeOrigin: true,
        secure: sslCert ? false : undefined,
        pathRewrite: isServer
          ? (path: string) => {
              if (path.includes('/server')) {
                return path;
              } else {
                return `browser/${path}`;
              }
            }
          : undefined,
      })
    );

    const proxyServer = (sslCert ? https : http)
      .createServer({ cert: sslCert, key: sslKey }, expressProxy)
      .listen(config.port);

    process.on('SIGTERM', () => proxyServer.close());
    process.on('exit', () => proxyServer.close());
  }

  logger.info(
    `${logPrefix}${
      isServer ? ' SSR' : ''
    } Static remotes proxies started successfully`
  );
}
