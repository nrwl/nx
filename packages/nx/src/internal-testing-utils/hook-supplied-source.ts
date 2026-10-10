import { spawnSync } from 'child_process';
import { join } from 'path';
import { pathToFileURL } from 'url';

/**
 * Runs `script` as an ES module under a loader hook that supplies CommonJS
 * source, as Yarn PnP does for zipped packages on some Node versions. Node
 * then hands those CommonJS modules a require without require.cache.
 */
export function runWithHookSuppliedSource(script: string) {
  const register = join(__dirname, 'hook-supplied-source/register.mjs');
  return spawnSync(
    process.execPath,
    [
      '--conditions=@nx/nx-source',
      '--require',
      'ts-node/register',
      '--import',
      pathToFileURL(register).href,
      '--input-type=module',
      '-e',
      script,
    ],
    { encoding: 'utf-8', windowsHide: true }
  );
}
