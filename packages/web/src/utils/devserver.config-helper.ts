import { WebDevServerOptions } from '@nrwl/web/src/builders/dev-server/dev-server.impl';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export function getSslConfig(root: string, options: WebDevServerOptions) {
  return {
    key: readFileSync(resolve(root, options.sslKey), 'utf-8'),
    cert: readFileSync(resolve(root, options.sslCert), 'utf-8'),
  };
}

export function getProxyConfig(root: string, options: WebDevServerOptions) {
  const proxyPath = resolve(root, options.proxyConfig as string);
  return require(proxyPath);
}
