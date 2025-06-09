import { Config } from '@jest/types';
import { existsSync, removeSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { ChildProcess, exec, execSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';
import { runLocalRelease } from '../../scripts/local-registry/populate-storage';

let localRegistryProcess: ChildProcess | null = null;

const defaultRegistry = 'https://registry.npmjs.org/';

export default async function (globalConfig: Config.ConfigGlobals) {
  try {
    const isVerbose: boolean =
      process.env.NX_VERBOSE_LOGGING === 'true' || !!globalConfig.verbose;

    /**
     * For e2e-ci, e2e-local and macos-local-e2e we populate the verdaccio storage up front, but for other workflows we need
     * to run the full local release process before running tests.
     */
    const authToken = 'secretVerdaccioToken';

    // Get the currently configured registry
    let currentRegistry = getCurrentRegistry();

    // If configured registry is the default, start local registry and wait for it to change
    if (currentRegistry === defaultRegistry) {
      console.log('Default registry detected, starting local registry...');

      // Start the local registry
      localRegistryProcess = await startLocalRegistry(isVerbose);

      // Keep checking until the configured registry changes from default
      while (currentRegistry === defaultRegistry) {
        console.log(
          `Waiting for registry configuration to change from ${defaultRegistry}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 250));
        currentRegistry = getCurrentRegistry();
      }

      console.log(`Registry changed to: ${currentRegistry}`);
    } else {
      console.log(`Using configured registry: ${currentRegistry}`);
    }

    // Parse the registry URL to extract host and port
    const { hostname: listenAddress, port } = parseRegistryUrl(currentRegistry);

    // Configure the registry for all package managers
    await configureRegistry(currentRegistry, listenAddress, port, authToken);

    /**
     * If we started a local registry, we need to publish the packages to it.
     * Otherwise, wait until packages are published to the configured registry.
     */
    if (localRegistryProcess) {
      if (
        process.env.NX_E2E_SKIP_CLEANUP !== 'true' ||
        !existsSync('./build')
      ) {
        if (!isCI) {
          registerTsConfigPaths(join(__dirname, '../../tsconfig.base.json'));
          const { e2eCwd } = await import('./get-env-info');
          removeSync(e2eCwd);
        }
        console.log('Publishing packages to local registry');
        const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
        // Always show full release logs on CI, they should only happen once via e2e-ci
        await runLocalRelease(publishVersion, isCI || isVerbose);
      }
    } else {
      let publishedVersion = await getPublishedVersion(currentRegistry);
      console.log(`Testing Published version: Nx ${publishedVersion}`);
      if (publishedVersion) {
        process.env.PUBLISHED_VERSION = publishedVersion;
      }
    }
  } catch (err) {
    // Clean up registry if possible after setup related errors
    if (typeof global.e2eTeardown === 'function') {
      global.e2eTeardown();
      console.log('Killed local registry process due to an error during setup');
    }
    throw err;
  }
}

function getCurrentRegistry(): string {
  try {
    const result = execSync('npm config get registry', { encoding: 'utf8' });
    return result.trim();
  } catch {
    return 'https://registry.npmjs.org/';
  }
}

function parseRegistryUrl(registryUrl: string): {
  hostname: string;
  port: string;
} {
  try {
    const url = new URL(registryUrl);
    return {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    };
  } catch {
    // Fallback for invalid URLs
    return {
      hostname: 'localhost',
      port: '4873',
    };
  }
}

async function startLocalRegistry(isVerbose: boolean): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log(
      'Starting local registry with: nx run @nx/nx-source:local-registry'
    );

    const process = spawn('nx', ['run', '@nx/nx-source:local-registry'], {
      stdio: isVerbose ? 'inherit' : 'pipe',
      detached: false,
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start local registry: ${err.message}`));
    });
    resolve(process);
  });
}

async function configureRegistry(
  registry: string,
  listenAddress: string,
  port: string,
  authToken: string
) {
  process.env.npm_config_registry = registry;

  // Only configure auth token for local registry
  if (registry.includes(listenAddress)) {
    execSync(
      `npm config set //${listenAddress}:${port}/:_authToken "${authToken}" --ws=false`,
      {
        windowsHide: false,
      }
    );
  }

  // bun
  process.env.BUN_CONFIG_REGISTRY = registry;
  if (registry.includes(listenAddress)) {
    process.env.BUN_CONFIG_TOKEN = authToken;
  }

  // yarnv1
  process.env.YARN_REGISTRY = registry;

  // yarnv2
  process.env.YARN_NPM_REGISTRY_SERVER = registry;
  if (registry.includes(listenAddress)) {
    process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;
  }

  // Set up cleanup function
  global.e2eTeardown = () => {
    // Clean up npm config for local registry
    if (registry.includes(listenAddress)) {
      try {
        execSync(
          `npm config delete //${listenAddress}:${port}/:_authToken --ws=false`,
          {
            windowsHide: false,
          }
        );
      } catch {
        // Ignore cleanup errors
      }
    }

    // Kill local registry process if it exists
    if (localRegistryProcess) {
      try {
        localRegistryProcess.kill('SIGTERM');
        console.log('Stopped local registry process');
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

async function getNxVersionFromRegistry(
  registry: string
): Promise<string | undefined> {
  return new Promise((resolve) => {
    exec(
      `npm view nx@latest version --registry=${registry}`,
      {
        windowsHide: false,
      },
      (error, stdout) => {
        if (error) {
          return resolve(undefined);
        }
        return resolve(stdout.trim());
      }
    );
  });
}

async function getPublishedVersion(
  localRegistry: string,
  maxAttempts: number = 600,
  pollIntervalMs: number = 100
): Promise<string | undefined> {
  console.log('Waiting for Nx version to differ between registries...');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const shouldLog = attempt % 10 === 0 || attempt === 1;

    if (shouldLog) {
      console.log(
        `Attempt ${attempt}/${maxAttempts}: Checking registry versions...`
      );
    }

    const [defaultVersion, localVersion] = await Promise.all([
      getNxVersionFromRegistry(defaultRegistry),
      getNxVersionFromRegistry(localRegistry),
    ]);

    if (shouldLog) {
      console.log(
        `Default registry (${defaultRegistry}): ${
          defaultVersion || 'undefined'
        }`
      );
      console.log(
        `Local registry (${localRegistry}): ${localVersion || 'undefined'}`
      );
    }

    // If local version exists and differs from default, we're ready
    if (localVersion && defaultVersion && localVersion !== defaultVersion) {
      console.log(
        `✅ Version difference detected! Using local version: ${localVersion}`
      );
      return localVersion;
    }

    // If local version exists but default doesn't, we're also ready
    if (localVersion && !defaultVersion) {
      console.log(`✅ Local version available: ${localVersion}`);
      return localVersion;
    }

    if (attempt < maxAttempts) {
      console.log(`Waiting ${pollIntervalMs}ms before next check...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error(
    `Timeout after ${maxAttempts} attempts. No local release of Nx was published.`
  );
}
