// @ts-check
const { exec, execSync } = require('node:child_process');
const {
  LARGE_BUFFER,
} = require('nx/src/executors/run-commands/run-commands.impl');

async function populateLocalRegistryStorage() {
  const listenAddress = 'localhost';
  const port = process.env.NX_LOCAL_REGISTRY_PORT ?? '4873';
  const registry = `http://${listenAddress}:${port}`;
  const authToken = 'secretVerdaccioToken';

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      await assertLocalRegistryIsRunning(registry);
      break;
    } catch {
      console.log(`Waiting for Local registry to start on ${registry}...`);
    }
  }

  process.env.npm_config_registry = registry;
  // npm publish requires credentials client-side even though the local
  // verdaccio allows anonymous publishing
  process.env[`npm_config_//${listenAddress}:${port}/:_authToken`] = authToken;

  // pnpm 11 reads pnpm_config_* env vars instead of npm_config_*
  process.env.pnpm_config_registry = registry;
  process.env[`pnpm_config_//${listenAddress}:${port}/:_authToken`] = authToken;
  // pnpm 11's minimumReleaseAge policy rejects packages published < 24h ago
  process.env.pnpm_config_minimum_release_age = '0';

  // bun
  process.env.BUN_CONFIG_REGISTRY = registry;
  process.env.BUN_CONFIG_TOKEN = authToken;
  // yarnv1
  process.env.YARN_REGISTRY = registry;
  // yarnv2
  process.env.YARN_NPM_REGISTRY_SERVER = registry;
  process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

  try {
    const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
    const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

    console.log('Publishing packages to local registry to populate storage');
    await runLocalRelease(publishVersion, isVerbose);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
exports.populateLocalRegistryStorage = populateLocalRegistryStorage;

function runLocalRelease(publishVersion, isVerbose) {
  return new Promise((res, rej) => {
    // pnpm exec, NOT the `pnpm nx-release` run-script: `pnpm run` overwrites
    // the inherited npm_config_registry with pnpm's own file-resolved
    // registry, which breaks nx-release's localhost safety check now that
    // nothing writes the local registry to ~/.npmrc.
    const publishProcess = exec(
      `pnpm exec nx nx-release @nx/nx-source --parallel 8 --local ${publishVersion}`,
      {
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      }
    );
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
      res(undefined);
    });
  });
}
exports.runLocalRelease = runLocalRelease;

async function assertLocalRegistryIsRunning(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}
