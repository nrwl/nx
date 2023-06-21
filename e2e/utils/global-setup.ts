import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { join } from 'path';
import { exec } from 'child_process';
import { tmpdir } from 'tmp';
import { existsSync } from 'fs-extra';
import { Config } from '@jest/types';

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

  if (
    process.env.NX_E2E_SKIP_BUILD_CLEANUP !== 'true' ||
    !existsSync('./build')
  ) {
    console.log('Publishing packages to local registry');
    await new Promise<void>((res, rej) => {
      const publishProcess = exec('pnpm nx-release --local major', {
        env: process.env,
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
