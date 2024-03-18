import { join } from 'path';

import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { exec } from 'child_process';
import { tmpdir } from 'tmp';
import { existsSync, removeSync } from 'fs-extra';
import { Config } from '@jest/types';
import * as isCI from 'is-ci';

const LARGE_BUFFER = 1024 * 1000000;

export default async function (globalConfig: Config.ConfigGlobals) {
  const isVerbose: boolean =
    process.env.NX_VERBOSE_LOGGING === 'true' || !!globalConfig.verbose;
  const storageLocation = join(
    tmpdir,
    'local-registry/storage',
    process.env.NX_TASK_TARGET_PROJECT ?? ''
  );
  global.e2eTeardown = await startLocalRegistry({
    localRegistryTarget: '@nx/nx-source:local-registry',
    verbose: isVerbose,
    storage: storageLocation,
  });

  if (process.env.NX_E2E_SKIP_CLEANUP !== 'true' || !existsSync('./build')) {
    if (!isCI) {
      registerTsConfigPaths(join(__dirname, '../../tsconfig.base.json'));
      const { e2eCwd } = await import('./get-env-info');
      removeSync(e2eCwd);
    }
    console.log('Publishing packages to local registry');
    const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
    await new Promise<void>((res, rej) => {
      const publishProcess = exec(`pnpm nx-release --local ${publishVersion}`, {
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      });
      let logs = Buffer.from('');
      if (isVerbose) {
        publishProcess?.stdout?.pipe(process.stdout);
        publishProcess?.stderr?.pipe(process.stderr);
      } else {
        publishProcess?.stdout?.on('data', (data) => (logs += data));
        publishProcess?.stderr?.on('data', (data) => (logs += data));
      }
      publishProcess.on('exit', (code) => {
        if (code && code > 0) {
          if (!isVerbose) {
            console.log(logs.toString());
          }
          rej(code);
        }
        res();
      });
    });
  }
}
