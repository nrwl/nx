import { exec } from 'child_process';
import type { PackageJson } from 'nx/src/utils/package-json';

/**
 * Returns the npm registry that is used for publishing.
 *
 * The following hierarchy is used to determine the registry:
 * - Scoped registry in the .npmrc file
 * - publishConfig in the package.json file
 * - registry argument passed via js or CLI args
 * - registry in the npm config
 *
 * This hierarchy matches how the npm CLI determines the registry when publishing packages.
 *
 * @param packageName the name of the package from which to determine the scope
 * @param cwd the directory where the npm config should be read from
 * @param publishConfig the publishConfig for the package
 * @param registryArg the registry passed via js or CLI args
 */
export async function getNpmRegistry(
  packageName: string,
  cwd: string,
  publishConfig: PackageJson['publishConfig'],
  registryArg: string | undefined
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

  // The registry argument passed to the executing code does NOT take precedence over
  // a scoped registry in the .npmrc file or the publishConfig in the package.json file.
  // This matches the behavior of `npm publish`.
  if (!registry) {
    registry = registryArg;
  }

  if (!registry) {
    registry = await getNpmConfigValue('registry', cwd);
  }

  return registry;
}

/**
 * Returns the npm tag that is used for publishing.
 *
 * If a tag is passed via js or CLI args, it will be used.
 * Otherwise, the tag will be determined by the npm config.
 *
 * This matches how the npm CLI determines the tag when publishing packages.
 *
 * @param cwd the directory where the npm config should be read from
 * @param tagArg the tag passed via js or CLI args
 */
export async function getNpmTag(
  cwd: string,
  tagArg: string | undefined
): Promise<string> {
  if (tagArg) {
    return tagArg;
  }

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
