import { major } from 'semver';
import { logger } from '../logger';
import { getBunSpawnRegistryEnv } from './bun';
import { getPnpmSpawnRegistryEnv } from './pnpm';
import { getYarnBerrySpawnRegistryEnv } from './yarn-berry';
import { getYarnClassicSpawnRegistryEnv } from './yarn-classic';
import type { NpmConfigEnv } from './utils';

// Type-only import: a value import would create a cycle with package-manager.ts.
import type { PackageManager } from '../package-manager';

export type { NpmConfigEnv } from './utils';

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
    switch (packageManager) {
      case 'npm':
        // npm resolves its own config; the spawned npm IS the package manager.
        return {};
      case 'pnpm':
        return getPnpmSpawnRegistryEnv(
          packageName,
          root,
          packageManagerVersion
        );
      case 'yarn':
        if (!packageManagerVersion) {
          // Without the version we cannot tell classic from berry, so we cannot
          // reproduce yarn's registry resolution; npm falls back to its own
          // config (the pre-existing behavior). Warn once so a silent revert to
          // npm's default registry is diagnosable.
          warnUnknownYarnVersion();
          return {};
        }
        return major(packageManagerVersion) >= 2
          ? getYarnBerrySpawnRegistryEnv(
              packageName,
              root,
              packageManagerVersion
            )
          : getYarnClassicSpawnRegistryEnv(packageName, root);
      case 'bun':
        return getBunSpawnRegistryEnv(packageName, root, packageManagerVersion);
    }
  } catch {
    return {};
  }
}

let warnedUnknownYarnVersion = false;
function warnUnknownYarnVersion(): void {
  if (warnedUnknownYarnVersion) {
    return;
  }
  warnedUnknownYarnVersion = true;
  logger.warn(
    `Could not determine the yarn version; skipping yarn registry configuration when fetching packages. They will be fetched using npm's own registry resolution, which may differ from yarn's (for example, a custom registry configured only in .yarnrc.yml).`
  );
}
