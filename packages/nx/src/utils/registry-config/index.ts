import { major } from 'semver';
import { logger } from '../logger';
import { getBunSpawnRegistryEnv } from './bun';
import { getPnpmSpawnRegistryEnv } from './pnpm';
import { getYarnBerrySpawnRegistryEnv } from './yarn-berry';
import { getYarnClassicSpawnRegistryEnv } from './yarn-classic';
import {
  getPackageScope,
  normalizeNpmConfigKey,
  setRegistry,
  type NpmConfigEnv,
} from './utils';

// A value import would create a cycle with package-manager.ts.
import type { PackageManager } from '../package-manager';

export type { NpmConfigEnv } from './utils';
export {
  getPackageScope,
  mergeNpmConfigEnv,
  ignoresNpmConfigEnv,
} from './utils';

/**
 * Computes the npm_config_* environment entries a spawned `npm view`/`npm pack`
 * (or a pre-v11 `pnpm view`, which passes through to npm) needs so its registry,
 * auth and TLS resolution reproduces what the workspace's package manager would
 * do for `packageName`. Returns an empty object when nothing needs bridging (npm
 * workspaces, or config npm already resolves identically on its own) and when
 * resolution fails, which is warned about rather than thrown.
 */
export function getNpmSpawnRegistryEnv(
  packageName: string,
  root: string,
  packageManager: PackageManager,
  packageManagerVersion: string | null
): NpmConfigEnv {
  try {
    const env = resolveSpawnRegistryEnv(
      packageName,
      root,
      packageManager,
      packageManagerVersion
    );
    reconcileScopedRegistryKey(env, packageName);
    return env;
  } catch (e) {
    // The warning omits the cause because an rc parse error quotes the lines
    // around the fault, which in these files is credential material.
    warnUnresolvedConfig(packageManager);
    logger.verbose(
      `Failed to resolve the ${packageManager} registry configuration; falling back to npm's own resolution.`,
      e
    );
    return {};
  }
}

function resolveSpawnRegistryEnv(
  packageName: string,
  root: string,
  packageManager: PackageManager,
  packageManagerVersion: string | null
): NpmConfigEnv {
  switch (packageManager) {
    case 'npm':
      // npm resolves its own config; the spawned npm IS the package manager.
      return {};
    case 'pnpm':
      if (!packageManagerVersion) {
        // Which surfaces pnpm honors depends on its version.
        warnUnknownVersion(
          'pnpm',
          'a registry configured only in pnpm-workspace.yaml'
        );
        return {};
      }
      return getPnpmSpawnRegistryEnv(packageName, root, packageManagerVersion);
    case 'yarn':
      if (!packageManagerVersion) {
        // Without the version we cannot tell classic from berry.
        warnUnknownVersion('yarn', 'a registry configured only in .yarnrc.yml');
        return {};
      }
      return major(packageManagerVersion) >= 2
        ? getYarnBerrySpawnRegistryEnv(packageName, root, packageManagerVersion)
        : getYarnClassicSpawnRegistryEnv(packageName, root);
    case 'bun':
      return getBunSpawnRegistryEnv(packageName, root, packageManagerVersion);
    default: {
      // getNpmSpawnRegistryEnv catches this and falls open to no bridging.
      const _exhaustive: never = packageManager;
      throw new Error(`Unhandled package manager: ${_exhaustive}`);
    }
  }
}

// npm's loadEnv lowercases an env key and rewrites its non-leading `_` to `-`,
// but looks @scope:registry up verbatim, so a bridged override for such a scope
// is never found. The command targets this package, so redirect the default.
function reconcileScopedRegistryKey(
  env: NpmConfigEnv,
  packageName: string
): void {
  const scope = getPackageScope(packageName);
  if (!scope) {
    return;
  }
  const scopedRegistry = env[`npm_config_${scope}:registry`];
  if (!scopedRegistry) {
    return;
  }
  const key = `${scope}:registry`;
  if (normalizeNpmConfigKey(key) !== key) {
    setRegistry(env, scopedRegistry);
  }
}

const warnedUnresolvedConfigs = new Set<PackageManager>();
// Reached by a failed read and equally by a malformed value the read returned,
// so the wording stays on resolution rather than naming a file.
function warnUnresolvedConfig(packageManager: PackageManager): void {
  if (warnedUnresolvedConfigs.has(packageManager)) {
    return;
  }
  warnedUnresolvedConfigs.add(packageManager);
  logger.warn(
    `Could not resolve the ${packageManager} configuration; packages will be fetched using npm's own registry resolution, which may differ from ${packageManager}'s. Run with NX_VERBOSE_LOGGING=true for the cause.`
  );
}

const warnedUnknownVersions = new Set<PackageManager>();
function warnUnknownVersion(
  packageManager: PackageManager,
  example: string
): void {
  if (warnedUnknownVersions.has(packageManager)) {
    return;
  }
  warnedUnknownVersions.add(packageManager);
  logger.warn(
    `Could not determine the ${packageManager} version; skipping ${packageManager} registry configuration when fetching packages. They will be fetched using npm's own registry resolution, which may differ from ${packageManager}'s (for example, ${example}).`
  );
}
