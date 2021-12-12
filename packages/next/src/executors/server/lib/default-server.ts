import * as express from 'express';
import * as path from 'path';
import next from 'next';
import { NextServerOptions, ProxyConfig } from '../../../utils/types';

/**
 * Adapted from https://github.com/zeit/next.js/blob/master/examples/with-custom-reverse-proxy/server.js
 * @param settings
 */
export async function defaultServer(
  settings: NextServerOptions,
  proxyConfig?: ProxyConfig
): Promise<void> {
  const app = next(settings);
  const handle = app.getRequestHandler();

  await app.prepare();

  const server: express.Express = express();
  server.disable('x-powered-by');

  // Serve shared assets copied to `public` folder
  server.use(
    express.static(path.resolve(settings.dir, settings.conf.outdir, 'public'))
  );

  // Set up the proxy.
  if (proxyConfig) {
    const proxyMiddleware =
      require('http-proxy-middleware').createProxyMiddleware;
    Object.keys(proxyConfig).forEach((context) => {
      server.use(proxyMiddleware(context, proxyConfig[context]));
    });
  }

  // Default catch-all handler to allow Next.js to handle all other routes
  server.all('*', (req, res) => handle(req, res));

  server.listen(settings.port, settings.hostname);
}
