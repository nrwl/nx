import { exec } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { detectPackageManager, getPackageManagerVersion } from '@nx/devkit';
import { gte } from 'semver';
import { PackageJson } from '@nx/devkit/internal';

export async function parseRegistryOptions(
  cwd: string,
  pkg: {
    packageRoot: string;
    packageJson: PackageJson;
  },
  options: {
    registry?: string;
    tag?: string;
  },
  logWarnFn: (message: string) => void = console.warn
): Promise<{ registry: string; tag: string; registryConfigKey: string }> {
  const npmRcPath = join(pkg.packageRoot, '.npmrc');
  if (existsSync(npmRcPath)) {
    const relativeNpmRcPath = relative(cwd, npmRcPath);
    logWarnFn(
      `\nIgnoring .npmrc file detected in the package root: ${relativeNpmRcPath}. Nested .npmrc files are not supported by npm. Only the .npmrc file at the root of the workspace will be used. To customize the registry or tag for specific packages, see https://nx.dev/recipes/nx-release/configure-custom-registries\n`
    );
  }

  const scope = pkg.packageJson.name.startsWith('@')
    ? pkg.packageJson.name.split('/')[0]
    : '';

  // If the package is scoped, then the registry argument that will
  // correctly override the registry in the .npmrc file must be scoped.
  const registryConfigKey = scope ? `${scope}:registry` : 'registry';

  const publishConfigRegistry =
    pkg.packageJson.publishConfig?.[registryConfigKey];

  // Even though it won't override the actual registry that's actually used,
  // the user might think otherwise, so we should still warn if the user has
  // set a 'registry' in 'publishConfig' for a scoped package.
  if (publishConfigRegistry || pkg.packageJson.publishConfig?.registry) {
    const relativePackageJsonPath = relative(
      cwd,
      join(pkg.packageRoot, 'package.json')
    );
    if (options.registry) {
      logWarnFn(
        `\nRegistry detected in the 'publishConfig' of the package manifest: ${relativePackageJsonPath}. This will override your registry option set in the project configuration or passed via the --registry argument, which is why configuring the registry with 'publishConfig' is not recommended. For details, see https://nx.dev/recipes/nx-release/configure-custom-registries\n`
      );
    } else {
      logWarnFn(
        `\nRegistry detected in the 'publishConfig' of the package manifest: ${relativePackageJsonPath}. Configuring the registry in this way is not recommended because it prevents the registry from being overridden in project configuration or via the --registry argument. To customize the registry for specific packages, see https://nx.dev/recipes/nx-release/configure-custom-registries\n`
      );
    }
  }

  const registry =
    // `npm publish` will always use the publishConfig registry if it exists, even over the --registry arg
    publishConfigRegistry ||
    options.registry ||
    (await getNpmRegistry(cwd, scope));
  const tag = options.tag || (await getNpmTag(cwd));

  return { registry, tag, registryConfigKey };
}

/**
 * Returns the npm registry that is used for publishing.
 *
 * @param scope the scope of the package for which to determine the registry
 * @param cwd the directory where the npm config should be read from
 */
export async function getNpmRegistry(
  cwd: string,
  scope?: string
): Promise<string> {
  let registry: string | undefined;

  if (scope) {
    registry = await getNpmConfigValue(`${scope}:registry`, cwd);
  }

  if (!registry) {
    registry = await getNpmConfigValue('registry', cwd);
  }

  return registry;
}

/**
 * Returns the npm tag that is used for publishing.
 *
 * @param cwd the directory where the npm config should be read from
 */
export async function getNpmTag(cwd: string): Promise<string> {
  // npm does not support '@scope:tag' in the npm config, so we only need to check for 'tag'.
  return (await getNpmConfigValue('tag', cwd)) ?? 'latest';
}

async function getNpmConfigValue(
  key: string,
  cwd: string
): Promise<string | undefined> {
  // pnpm v11+ resolves config itself and may be the only binary on PATH (e.g. Node
  // provisioned via `pnpm runtime` / the `pnpm/setup` action, which ships no bundled
  // npm). Everything else resolves config through npm.
  const pm = detectPackageManager(cwd);
  const bin = pm === 'pnpm' && isPnpmV11Plus(cwd) ? 'pnpm' : 'npm';
  try {
    const result = await execAsync(`${bin} config get ${key}`, cwd);
    return result && result !== 'undefined' ? result : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the workspace's pnpm is v11+, which can publish, resolve registry
 * metadata, and resolve config without npm on PATH. pnpm v10 and below still
 * require npm.
 */
export function isPnpmV11Plus(cwd: string): boolean {
  try {
    return gte(getPackageManagerVersion('pnpm', cwd), '11.0.0');
  } catch {
    return false;
  }
}

async function execAsync(command: string, cwd: string): Promise<string> {
  // Must be non-blocking async to allow spinner to render
  return new Promise<string>((resolve, reject) => {
    exec(command, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        return reject((stderr ? `${stderr}\n` : '') + error);
      }
      return resolve(stdout.trim());
    });
  });
}
