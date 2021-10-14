import * as webpack from 'webpack';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';
import { Observable } from 'rxjs';
import { extname } from 'path';

export function runWebpack(config: webpack.Configuration): Observable<any> {
  return new Observable((subscriber) => {
    // Passing `watch` option here will result in a warning due to missing callback.
    // We manually call `.watch` or `.run` later so this option isn't needed here.
    const { watch, ...normalizedConfig } = config;
    const webpackCompiler = webpack(normalizedConfig);

    const callback = (err: Error, stats: webpack.Stats) => {
      if (err) {
        subscriber.error(err);
      }
      subscriber.next(stats);
    };

    if (config.watch) {
      const watchOptions = config.watchOptions || {};
      const watching = webpackCompiler.watch(watchOptions, callback);

      return () => watching.close(() => subscriber.complete());
    } else {
      webpackCompiler.run((err, stats) => {
        callback(err, stats);
        webpackCompiler.close((closeErr) => {
          if (closeErr) subscriber.error(closeErr);
          subscriber.complete();
        });
      });
    }
  });
}

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

export interface EmittedFile {
  id?: string;
  name?: string;
  file: string;
  extension: string;
  initial: boolean;
  asset?: boolean;
}

export function getEmittedFiles(stats: webpack.Stats) {
  const { compilation } = stats;
  const files: EmittedFile[] = [];
  // adds all chunks to the list of emitted files such as lazy loaded modules
  for (const chunk of compilation.chunks) {
    for (const file of chunk.files) {
      files.push({
        // The id is guaranteed to exist at this point in the compilation process
        // tslint:disable-next-line: no-non-null-assertion
        id: chunk.id.toString(),
        name: chunk.name,
        file,
        extension: extname(file),
        initial: chunk.isOnlyInitial(),
      });
    }
  }
  // other all files
  for (const file of Object.keys(compilation.assets)) {
    files.push({
      file,
      extension: extname(file),
      initial: false,
      asset: true,
    });
  }
  // dedupe
  return files.filter(
    ({ file, name }, index) =>
      files.findIndex((f) => f.file === file && (!name || name === f.name)) ===
      index
  );
}
