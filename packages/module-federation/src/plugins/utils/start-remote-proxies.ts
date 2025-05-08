import { StaticRemoteConfig } from '../../utils';
import { existsSync, readFileSync } from 'fs';
import { Express } from 'express';

export function startRemoteProxies(
  staticRemotesConfig: Record<string, StaticRemoteConfig>,
  mappedLocationsOfRemotes: Record<string, string>,
  sslOptions?: {
    pathToCert: string;
    pathToKey: string;
  },
  isServer?: boolean
) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  const express = require('express');
  let sslCert: Buffer | undefined;
  let sslKey: Buffer | undefined;
  if (sslOptions && sslOptions.pathToCert && sslOptions.pathToKey) {
    if (existsSync(sslOptions.pathToCert) && existsSync(sslOptions.pathToKey)) {
      sslCert = readFileSync(sslOptions.pathToCert);
      sslKey = readFileSync(sslOptions.pathToKey);
    } else {
      console.warn(
        `Encountered SSL options in project.json, however, the certificate files do not exist in the filesystem. Using http.`
      );
      console.warn(
        `Attempted to find '${sslOptions.pathToCert}' and '${sslOptions.pathToKey}'.`
      );
    }
  }
  const http = require('http');
  const https = require('https');

  const remotes = Object.keys(staticRemotesConfig);
  console.log(`NX Starting static remotes proxies...`);
  for (const app of remotes) {
    const appConfig = staticRemotesConfig[app];
    const expressProxy: Express = express();
    expressProxy.use(
      createProxyMiddleware({
        target: mappedLocationsOfRemotes[app],
        changeOrigin: true,
        secure: sslCert ? false : undefined,
        pathRewrite: isServer
          ? (path) => {
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
      .listen(appConfig.port);
    process.on('exit', () => proxyServer.close());
  }
  console.info(`NX Static remotes proxies started successfully`);
}
