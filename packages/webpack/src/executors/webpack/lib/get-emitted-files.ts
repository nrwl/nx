import type { Stats } from 'webpack';
import { extname } from 'path';

import { EmittedFile } from '../../../utils/models';

export function getEmittedFiles(stats: Stats) {
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
