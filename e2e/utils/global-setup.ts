import { Config } from '@jest/types';
import { existsSync, removeSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { exec, execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { registerTsConfigPaths } from '../../packages/nx/src/plugins/js/utils/register';
import { runLocalRelease } from '../../scripts/local-registry/populate-storage';

export default async function (globalConfig: Config.ConfigGlobals) {
  try {
    // TEMP DIAGNOSTIC (cache-miss hunt): log the exact checkout + any working-tree
    // drift on the agent. Distinguishes "runs are on different SHAs" from
    // "same SHA but a task mutated the tree". Safe to remove once resolved.
    if (process.env.CI) {
      try {
        const head = execSync('git rev-parse HEAD').toString().trim();
        const porcelain = execSync('git status --porcelain').toString().trim();
        console.log(
          `\n=== [tree-state] target=${process.env.NX_TASK_TARGET_TARGET} HEAD=${head} ===\n` +
            `git status --porcelain:\n${porcelain || '(clean)'}\n`
        );
      } catch (err) {
        console.log(
          `[tree-state] diagnostic failed: ${(err as Error).message}`
        );
      }
    }

    const isVerbose: boolean =
      process.env.NX_VERBOSE_LOGGING === 'true' || !!globalConfig.verbose;

    /**
     * For e2e-ci, e2e-local and macos-local-e2e we populate the verdaccio storage up front, but for other workflows we need
     * to run the full local release process before running tests.
     */
    const prefixes = ['e2e-ci', 'e2e-macos-local', 'e2e-local'];
    const requiresLocalRelease = !prefixes.some((prefix) =>
      process.env.NX_TASK_TARGET_TARGET?.startsWith(prefix)
    );

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
    // Use environment variable instead of npm config command to avoid polluting other tests
    process.env[`npm_config_//${listenAddress}:${port}/:_authToken`] =
      authToken;
    // pnpm 11 reads pnpm_config_* env vars instead of npm_config_*, and they
    // take precedence over any registry a stray process wrote to ~/.npmrc.
    process.env.pnpm_config_registry = registry;
    process.env[`pnpm_config_//${listenAddress}:${port}/:_authToken`] =
      authToken;
    // pnpm 11's minimumReleaseAge policy rejects packages published < 24h
    // ago; everything e2e installs was just published to the local registry.
    process.env.pnpm_config_minimum_release_age = '0';
    // e2e installs plugin packages directly (no generator records allowBuilds
    // decisions for their transitive deps), and pnpm 11 re-checks the whole
    // workspace strictly on every implicit deps check (`pnpm exec nx ...`),
    // so restore pnpm 10's warn-and-skip for the whole harness and skip the
    // implicit install-before-run entirely.
    process.env.pnpm_config_strict_dep_builds = 'false';
    process.env.pnpm_config_verify_deps_before_run = 'false';
    // pnpm 11 no longer reads pnpm settings from .npmrc, so the workspace
    // prefer-frozen-lockfile=false workaround stopped applying; without this,
    // tests that edit a package.json and re-run `pnpm install` fail in CI
    // where frozen-lockfile defaults to true.
    process.env.pnpm_config_frozen_lockfile = 'false';

    // bun
    process.env.BUN_CONFIG_REGISTRY = registry;
    process.env.BUN_CONFIG_TOKEN = authToken;
    // yarnv1
    process.env.YARN_REGISTRY = registry;
    // yarnv2
    process.env.YARN_NPM_REGISTRY_SERVER = registry;
    process.env.YARN_UNSAFE_HTTP_WHITELIST = listenAddress;

    // Use fresh cache directories to avoid serving stale packages when the
    // same version is republished to the local registry.
    const e2eCacheDir = mkdtempSync(join(tmpdir(), 'nx-e2e-cache-'));
    process.env.npm_config_cache = join(e2eCacheDir, 'npm');
    // yarnv1
    process.env.YARN_CACHE_FOLDER = join(e2eCacheDir, 'yarn');
    // yarnv2
    process.env.YARN_ENABLE_GLOBAL_CACHE = 'false';

    process.env.NX_SKIP_PROVENANCE_CHECK = 'true';

    global.e2eTeardown = () => {
      // Clean up environment variable instead of npm config command
      delete process.env[`npm_config_//${listenAddress}:${port}/:_authToken`];
      delete process.env[`pnpm_config_//${listenAddress}:${port}/:_authToken`];
    };

    /**
     * Set the published version based on what has previously been loaded into the
     * verdaccio storage.
     */
    if (!requiresLocalRelease) {
      let publishedVersion = await getPublishedVersion();
      console.log(`Testing Published version: Nx ${publishedVersion}`);
      if (publishedVersion) {
        process.env.PUBLISHED_VERSION = publishedVersion;
      }
    }

    if (
      process.env.NX_E2E_SKIP_GLOBAL_CLEANUP !== 'true' ||
      !existsSync('./build')
    ) {
      if (!isCI) {
        registerTsConfigPaths(join(__dirname, '../../tsconfig.base.json'));
        const { e2eCwd } = await import('./get-env-info');
        removeSync(e2eCwd);
      }
      if (requiresLocalRelease) {
        console.log('Publishing packages to local registry');
        const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
        // Always show full release logs on CI, they should only happen once via e2e-ci
        await runLocalRelease(publishVersion, isCI || isVerbose);
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

function getPublishedVersion(): Promise<string | undefined> {
  execSync(`npm config get registry`, {
    stdio: 'inherit',
  });
  return new Promise((resolve) => {
    // Resolve the published nx version from verdaccio
    exec(
      'npm view nx@latest version',
      {
        windowsHide: false,
      },
      (error, stdout, stderr) => {
        if (error) {
          return resolve(undefined);
        }
        return resolve(stdout.trim());
      }
    );
  });
}

async function assertLocalRegistryIsRunning(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}
