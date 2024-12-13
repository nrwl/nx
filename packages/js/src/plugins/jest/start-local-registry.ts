import { execSync, fork } from 'child_process';
export const kill = require('kill-port');

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
}): Promise<() => Promise<void>> {
  if (!localRegistryTarget) {
    throw new Error(`localRegistryTarget is required`);
  }
  let port: number | undefined;
  return new Promise<() => Promise<void>>((resolve, reject) => {
    const childProcess = fork(
      require.resolve('nx'),
      [
        ...`run ${localRegistryTarget} --location none --clear ${
          clearStorage ?? true
        }`.split(' '),
        ...(storage ? [`--storage`, storage] : []),
        ...(verbose ? ['--verbose'] : []),
        ...(listenAddress ? ['--listenAddress', listenAddress] : []),
      ],
      { stdio: 'pipe' }
    );

    listenAddress ??= 'localhost';
    const listener = (data) => {
      if (verbose) {
        process.stdout.write(data);
        console.log('Waiting for local registry to start...');
      }
      if (data.toString().includes(`http://${listenAddress}:`)) {
        port = parseInt(
          data.toString().match(new RegExp(`${listenAddress}:(?<port>\\d+)`))
            ?.groups?.port
        );

        const registry = `http://${listenAddress}:${port}`;

        console.log(`Local registry started on ${registry}`);

        process.env.npm_config_registry = registry;
        execSync(
          `npm config set //${listenAddress}:${port}/:_authToken "secretVerdaccioToken"`,
          {
            windowsHide: false,
          }
        );

        // yarnv1
        process.env.YARN_REGISTRY = registry;
        // yarnv2
        process.env.YARN_NPM_REGISTRY_SERVER = registry;
        process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

        console.log('Set npm and yarn config registry to ' + registry);

        resolve(async () => {
          childProcess?.kill();
          await kill(port);
          execSync(`npm config delete //${listenAddress}:${port}/:_authToken`, {
            windowsHide: false,
          });
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
    childProcess.on('exit', (code) => {
      console.log('local registry exit', code);
      if (code !== 0) {
        reject(code);
      } else {
        resolve(() => {});
      }
    });
    const killChildProcess = async (signal?: number | NodeJS.Signals) => {
      childProcess?.kill(signal);
      if (port) {
        await kill(port);
        execSync(
          `npm config delete //${
            listenAddress ?? 'localhost'
          }:${port}/:_authToken`,
          {
            windowsHide: false,
          }
        );
      }
    };
    process.on('exit', killChildProcess);
    process.on('SIGTERM', killChildProcess);
    process.on('SIGINT', killChildProcess);
    process.on('SIGHUP', killChildProcess);
  });
}

export default startLocalRegistry;
