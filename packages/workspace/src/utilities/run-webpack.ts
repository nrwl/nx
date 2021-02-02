import * as webpack from 'webpack';
import { Observable } from 'rxjs';
import { Stats, Configuration } from 'webpack';
import { extname } from 'path';

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
      webpackCompiler.watch(watchOptions, callback);
    } else {
      webpackCompiler.run((err, stats) => {
        callback(err, stats);
        subscriber.complete();
      });
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
