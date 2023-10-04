import * as webpack from 'webpack';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';
import { Observable } from 'rxjs';
import { extname } from 'path';

export function runWebpackDevServer(
  config: any,
  webpack: typeof import('webpack'),
  WebpackDevServer: typeof import('webpack-dev-server')
): Observable<{ stats: any; baseUrl: string }> {
  return new Observable((subscriber) => {
    const webpackCompiler: any = webpack(config);

    let baseUrl: string;

    webpackCompiler.hooks.done.tap('build-webpack', (stats) => {
      subscriber.next({ stats, baseUrl });
    });

    const devServerConfig = (config as any).devServer || {};

    const originalOnListen = devServerConfig.onListening;

    devServerConfig.onListening = function (server: any) {
      originalOnListen(server);

      const devServerOptions: WebpackDevServerConfiguration = server.options;

      baseUrl = `${server.options.https ? 'https' : 'http'}://${
        server.options.host
      }:${server.options.port}${devServerOptions.devMiddleware.publicPath}`;
    };

    const webpackServer = new WebpackDevServer(
      devServerConfig,
      webpackCompiler as any
    );

    try {
      webpackServer.start().catch((err) => subscriber.error(err));
      return () => webpackServer.stop();
    } catch (e) {
      throw new Error('Could not start start dev server');
    }
  });
}
