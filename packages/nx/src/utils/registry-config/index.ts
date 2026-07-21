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

// Type-only import: a value import would create a cycle with package-manager.ts.
import type { PackageManager } from '../package-manager';

export type { NpmConfigEnv } from './utils';
export { mergeNpmConfigEnv } from './utils';

/**
 * Computes the npm_config_* environment entries a spawned `npm view`/`npm pack`
 * (or a pre-v11 `pnpm view`, which passes through to npm) needs so its registry,
 * auth, and TLS resolution faithfully reproduces what the workspace's package
 * manager would do for `packageName`. Returns an empty object when nothing
 * needs bridging (npm workspaces, or config that npm already resolves
 * identically on its own).
 *
 * The caller provides the detected package manager and its version
 * (null when the version cannot be determined); resolution errors degrade to
 * no bridging, matching the previous behavior.
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
    // Falling open to npm's own resolution keeps the command running, but it can
    // silently reach a different registry than the workspace configures, so
    // leave the cause recoverable.
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
        // Which surfaces pnpm honors depends on its version, so without one
        // there is nothing to reproduce.
        warnUnknownVersion(
          'pnpm',
          'a registry configured only in pnpm-workspace.yaml'
        );
        return {};
      }
      return getPnpmSpawnRegistryEnv(packageName, root, packageManagerVersion);
    case 'yarn':
      if (!packageManagerVersion) {
        // Without the version we cannot tell classic from berry, so we cannot
        // reproduce yarn's registry resolution.
        warnUnknownVersion('yarn', 'a registry configured only in .yarnrc.yml');
        return {};
      }
      return major(packageManagerVersion) >= 2
        ? getYarnBerrySpawnRegistryEnv(packageName, root, packageManagerVersion)
        : getYarnClassicSpawnRegistryEnv(packageName, root);
    case 'bun':
      return getBunSpawnRegistryEnv(packageName, root, packageManagerVersion);
    default: {
      // A new PackageManager member fails typecheck here until it is classified
      // above; getNpmSpawnRegistryEnv catches the throw and falls open to no
      // bridging.
      const _exhaustive: never = packageManager;
      throw new Error(`Unhandled package manager: ${_exhaustive}`);
    }
  }
}

// npm's loadEnv lowercases a non-`//` env-config key and rewrites its
// non-leading `_` to `-`, but resolves @scope:registry verbatim, so a scoped
// registry bridged for an underscore/uppercase scope is stored under a name the
// lookup never finds and the override is dropped. The view/pack command targets
// exactly this package, so point the default registry at the bridged scoped
// registry npm would otherwise miss.
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

// Warn once per package manager so a silent revert to npm's default registry is
// diagnosable without repeating the message for every package fetched.
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
