import { exec } from 'child_process';
import type { PackageJson } from 'nx/src/utils/package-json';

/**
 * Returns the npm registry that is used for publishing.
 *
 * Uses the packageName to determine the scope, then looks
 * for the registry for that scope in the npm config. If
 * not found, falls back to the publishConfig for the package.
 * Lastly, defers to the registry in the npm config, which
 * will default to the npm public registry if not set. This
 * hierarchy matches what the npm CLI uses when publishing packages.
 *
 * @param packageName the name of the package from which to determine the scope
 * @param cwd the directory where the npm config should be read from
 * @param publishConfig the publishConfig for the package
 */
export async function getNpmRegistry(
  packageName: string,
  cwd: string,
  publishConfig: PackageJson['publishConfig']
): Promise<string> {
  const scope = packageName.startsWith('@') ? packageName.split('/')[0] : null;

  let registry: string | undefined;

  // npm gives precedence to scoped package config in .npmrc, even over publishConfig in the package.json file
  if (scope) {
    registry = await getNpmConfigValue(`${scope}:registry`, cwd);
  }

  if (!registry) {
    registry = publishConfig?.registry;
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
  return getNpmConfigValue('tag', cwd);
}

async function getNpmConfigValue(key: string, cwd: string): Promise<string> {
  try {
    const result = await execAsync(`npm config get ${key}`, cwd);
    return result === 'undefined' ? undefined : result;
  } catch (e) {
    return Promise.resolve(undefined);
  }
}

async function execAsync(command: string, cwd: string): Promise<string> {
  // Must be non-blocking async to allow spinner to render
  return new Promise<string>((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      if (stderr) {
        return reject(stderr);
      }
      return resolve(stdout.trim());
    });
  });
}
