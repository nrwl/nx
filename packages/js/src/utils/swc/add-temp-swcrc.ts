import { readJsonFile, writeJsonFile } from '@nrwl/devkit';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { NormalizedSwcExecutorOptions } from '../schema';

// TODO(chau): "exclude" is required here to exclude spec files as --ignore cli option is not working atm
// Open issue: https://github.com/swc-project/cli/issues/20
export function addTempSwcrc(options: NormalizedSwcExecutorOptions) {
  const tmpPath = join(
    options.root,
    'tmp',
    options.projectRoot,
    '.swcrc.generated'
  );
  const swcrcJson = readJsonFile(join(options.projectRoot, '.swcrc'));

  process.on('exit', cleanUpSwcrc(tmpPath));

  writeJsonFile(tmpPath, {
    ...swcrcJson,
    exclude: options.swcExclude,
  });

  return tmpPath;
}

function cleanUpSwcrc(tmpPath: string) {
  return () => {
    try {
      if (tmpPath) {
        unlinkSync(tmpPath);
      }
    } catch (e) {}
  };
}
