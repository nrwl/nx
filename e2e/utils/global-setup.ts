import { join } from 'path';
import { ChildProcess, execSync, fork } from 'child_process';
import { tmpdir } from 'tmp';
import { existsSync } from 'fs-extra';
import { Config } from '@jest/types';

export default async function (globalConfig: Config.ConfigGlobals) {
  const isVerbose =
    process.env.NX_VERBOSE_LOGGING === 'true' || globalConfig.verbose;
  const storageLocation = join(
    tmpdir,
    'local-registry/storage',
    process.env.NX_TASK_TARGET_PROJECT ?? ''
  );
  global.nxLocalRegistryProcess = await new Promise<ChildProcess>(
    (resolve, reject) => {
      const childProcess = fork(
        require.resolve(`nx`),
        `local-registry @nx/nx-source --config scripts/local-registry/config.yml --location none --storage ${storageLocation} --clear ${
          process.env.NX_E2E_SKIP_BUILD_CLEANUP !== 'true'
        }`.split(' '),
        { stdio: 'pipe' }
      );

      childProcess?.stdout?.on('data', (data) => {
        if (data.toString().includes('http://localhost:')) {
          const port = parseInt(
            data.toString().match(/localhost:(?<port>\d+)/)?.groups?.port
          );
          console.log('Local registry started on port ' + port);

          const registry = `http://localhost:${port}`;
          process.env.npm_config_registry = registry;
          process.env.YARN_REGISTRY = registry;
          console.log('Set npm and yarn config registry to ' + registry);

          resolve(childProcess);
        }
      });
      childProcess?.stderr?.on('data', (data) => {
        process.stderr.write(data);
        reject(data);
      });
      childProcess.on('error', (err) => {
        console.log('local registry error', err);
        reject(err);
      });
      childProcess.on('exit', (code) => {
        console.log('local registry exit', code);
        reject(code);
      });
    }
  );

  if (
    process.env.NX_E2E_SKIP_BUILD_CLEANUP !== 'true' ||
    !existsSync('./build')
  ) {
    console.log('Publishing packages to local registry');
    execSync('pnpm nx-release --local major', {
      stdio: isVerbose ? 'inherit' : 'ignore',
    });
  }
}
