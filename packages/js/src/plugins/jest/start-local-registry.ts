import { signalToCode } from '@nx/devkit/internal';
import { execSync, fork } from 'child_process';
import {
  isPlaceholderAuthTokenRejected,
  PLACEHOLDER_AUTH_TOKEN,
  warnPlaceholderAuthTokenRejected,
} from '../../executors/verdaccio/placeholder-auth-token';

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
      require.resolve('nx/bin/nx'),
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
      const output = data.toString();
      const addressPrefix = `http://${listenAddress}:`;
      const addressIndex = output.indexOf(addressPrefix);
      if (addressIndex !== -1) {
        childProcess?.stdout?.off('data', listener);
        const port = parseInt(
          output.slice(addressIndex + addressPrefix.length)
        );

        const registry = `http://${listenAddress}:${port}`;
        const authTokenKey = `//${listenAddress}:${port}/:_authToken`;

        console.log(`Local registry started on ${registry}`);

        isPlaceholderAuthTokenRejected(registry)
          .then((authTokenRejected) => {
            if (authTokenRejected) {
              warnPlaceholderAuthTokenRejected(registry);
            } else {
              execSync(
                `npm config set ${authTokenKey} "${PLACEHOLDER_AUTH_TOKEN}" --ws=false`,
                {
                  windowsHide: true,
                }
              );
              process.env[`pnpm_config_${authTokenKey}`] =
                PLACEHOLDER_AUTH_TOKEN;
              process.env.BUN_CONFIG_TOKEN = PLACEHOLDER_AUTH_TOKEN;
            }

            process.env.npm_config_registry = registry;
            // pnpm 11 reads pnpm_config_* env vars instead of npm_config_*, and
            // they take precedence over any registry configured in ~/.npmrc
            process.env.pnpm_config_registry = registry;
            // bun
            process.env.BUN_CONFIG_REGISTRY = registry;
            // yarnv1
            process.env.YARN_REGISTRY = registry;
            // yarnv2
            process.env.YARN_NPM_REGISTRY_SERVER = registry;
            process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

            console.log(
              'Set npm, pnpm, bun, and yarn config registry to ' + registry
            );

            resolve(() => {
              childProcess.kill();
              if (!authTokenRejected) {
                execSync(`npm config delete ${authTokenKey} --ws=false`, {
                  windowsHide: true,
                });
              }
            });
          })
          .catch(reject);
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
