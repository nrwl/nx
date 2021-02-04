import * as webpack from 'webpack';
import { Stats, Configuration } from 'webpack';
import * as WebpackDevServer from 'webpack-dev-server';
import { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

import { Observable } from 'rxjs';

import { extname } from 'path';
import * as url from 'url';

export function runWebpack(config: Configuration): Observable<Stats> {
  return new Observable((subscriber) => {
    const webpackCompiler = webpack(config);

    function callback(err: Error, stats: Stats) {
      if (err) {
        subscriber.error(err);
      }
      subscriber.next(stats);
    }

    if (config.watch) {
      const watchOptions = config.watchOptions || {};
      const watching = webpackCompiler.watch(watchOptions, callback);

      return () => {
        watching.close(() => {});
      };
    } else {
      webpackCompiler.run((err, stats) => {
        callback(err, stats);
        subscriber.complete();
      });
    }
  });
}

export function runWebpackDevServer(
  config: Configuration
): Observable<{ stats: Stats; baseUrl: string }> {
  return new Observable((subscriber) => {
    const webpackCompiler = webpack(config);

    let baseUrl: string;

    webpackCompiler.hooks.done.tap('build-webpack', (stats) => {
      subscriber.next({ stats, baseUrl });
    });

    const devServerConfig = config.devServer || {};

    const originalOnListen = devServerConfig.onListening;

    devServerConfig.onListening = function (server: any) {
      originalOnListen(server);

      const devServerOptions: WebpackDevServerConfiguration = server.options;
      baseUrl = url.format({
        protocol: devServerOptions.https ? 'https' : 'http',
        hostname: server.hostname,
        port: server.listeningApp.address().port,
        pathname: devServerOptions.publicPath,
      });
    };

    const webpackServer = new WebpackDevServer(
      webpackCompiler,
      devServerConfig
    );

    try {
      const server = webpackServer.listen(
        devServerConfig.port ?? 8080,
        devServerConfig.host ?? 'localhost',
        function (err) {
          if (err) {
            subscriber.error(err);
          }
        }
      );

      return () => {
        server.close();
      };
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
