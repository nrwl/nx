import type { Compiler } from '@rspack/core';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Vite's default `server.cors` origins, used by `ng serve` from Angular 22:
// http(s) on localhost, its subdomains, 127.0.0.1 and [::1], with any port
const LOCALHOST_ORIGIN =
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

/**
 * Lets pages on localhost origins read dev server responses, as `ng serve`
 * does from Angular 22. Runs before the dev server's middlewares, so `headers`,
 * proxied responses and later middlewares win, and passes preflights on to the
 * proxy.
 * Applied after the config merge: webpack-merge would join a config
 * `setupMiddlewares` with an override's into one that returns the list twice.
 */
export function applyDevServerCors(compiler: Compiler): void {
  const devServer = compiler.options.devServer;
  if (!devServer) {
    return;
  }
  const setupMiddlewares = devServer.setupMiddlewares;
  devServer.setupMiddlewares = (middlewares, server) => {
    middlewares.unshift({
      name: 'angular-cors',
      middleware: allowLocalhostOrigins,
    });
    return setupMiddlewares
      ? setupMiddlewares(middlewares, server)
      : middlewares;
  };
}

function allowLocalhostOrigins(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): void {
  const origin = req.headers.origin;
  if (origin && LOCALHOST_ORIGIN.test(origin)) {
    setUnlessSet(res, 'Access-Control-Allow-Origin', origin);
  }
  addVary(res, 'Origin');
  if (req.method === 'OPTIONS') {
    setUnlessSet(
      res,
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE'
    );
    const requestHeaders = req.headers['access-control-request-headers'];
    if (requestHeaders) {
      setUnlessSet(res, 'Access-Control-Allow-Headers', requestHeaders);
    }
    addVary(res, 'Access-Control-Request-Headers');
  }
  next();
}

// A middleware the user's `setupMiddlewares` puts first keeps its value
function setUnlessSet(res: ServerResponse, name: string, value: string): void {
  if (!res.hasHeader(name)) {
    res.setHeader(name, value);
  }
}

function addVary(res: ServerResponse, field: string): void {
  const vary = [res.getHeader('Vary') ?? []].flat().join(', ');
  const fields = vary
    .toLowerCase()
    .split(',')
    .map((name) => name.trim());
  if (!fields.includes('*') && !fields.includes(field.toLowerCase())) {
    res.setHeader('Vary', vary ? `${vary}, ${field}` : field);
  }
}
