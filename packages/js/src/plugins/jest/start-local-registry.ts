import { signalToCode } from '@nx/devkit/internal';
import { execSync, fork } from 'child_process';

/**
 * This function is used to start a local registry for testing purposes.
 * @param localRegistryTarget the target to run to start the local registry e.g. workspace:local-registry
 * @param storage the storage location for the local registry
 * @param verbose whether to log verbose output
 * @param clearStorage whether to clear the verdaccio storage before running the registry
 * @param listenAddress the address that verdaccio should listen to (default to `localhost`)
 */
export function startLocalRegistry({
  localRegistryTarget,
  storage,
  verbose,
  clearStorage,
  listenAddress,
}: {
  localRegistryTarget: string;
  storage?: string;
  verbose?: boolean;
  clearStorage?: boolean;
  listenAddress?: string;
}) {
  listenAddress ??= 'localhost';
  if (!localRegistryTarget) {
    throw new Error(`localRegistryTarget is required`);
  }
  return new Promise<() => void>((resolve, reject) => {
    const childProcess = fork(
      require.resolve('nx'),
      [
        ...`run ${localRegistryTarget} --location none --clear ${
          clearStorage ?? true
        }`.split(' '),
        ...(storage ? [`--storage`, storage] : []),
      ],
      { stdio: 'pipe' }
    );

    const listener = (data) => {
      if (verbose) {
        process.stdout.write(data);
        console.log('Waiting for local registry to start...');
      }
      if (data.toString().includes(`http://${listenAddress}:`)) {
        const port = parseInt(
          data.toString().match(new RegExp(`${listenAddress}:(?<port>\\d+)`))
            ?.groups?.port
        );

        const registry = `http://${listenAddress}:${port}`;
        const authToken = 'secretVerdaccioToken';

        console.log(`Local registry started on ${registry}`);

        process.env.npm_config_registry = registry;
        execSync(
          `npm config set //${listenAddress}:${port}/:_authToken "${authToken}" --ws=false`,
          {
            windowsHide: false,
          }
        );

        // bun
        process.env.BUN_CONFIG_REGISTRY = registry;
        process.env.BUN_CONFIG_TOKEN = authToken;
        // yarnv1
        process.env.YARN_REGISTRY = registry;
        // yarnv2
        process.env.YARN_NPM_REGISTRY_SERVER = registry;
        process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

        console.log('Set npm, bun, and yarn config registry to ' + registry);

        resolve(() => {
          childProcess.kill();
          execSync(
            `npm config delete //${listenAddress}:${port}/:_authToken --ws=false`,
            {
              windowsHide: false,
            }
          );
        });
        childProcess?.stdout?.off('data', listener);
      }
    };
    childProcess?.stdout?.on('data', listener);
    childProcess?.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });
    childProcess.on('error', (err) => {
      console.log('local registry error', err);
      reject(err);
    });
    childProcess.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      console.log('local registry exit', code);
      if (code !== 0) {
        reject(code);
      } else {
        resolve(() => {});
      }
    });
  });
}

export default startLocalRegistry;
