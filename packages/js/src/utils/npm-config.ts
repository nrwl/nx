import { execSync } from 'child_process';

/**
 * Returns the npm registry that is used for publishing.
 *
 * Uses the packageName to determine the scope, then looks
 * for the registry for that scope in the npm config. If
 * not found, falls back to the registry for packages with
 * no scope, which will default to the npm public registry
 * if not set.
 *
 * @param packageName the name of the package from which to determine the scope
 * @param cwd the directory where the npm config should be read from
 */
export function getNpmRegistry(packageName: string, cwd: string): string {
  const scope = packageName.startsWith('@') ? packageName.split('/')[0] : null;

  let registry = undefined;
  if (scope) {
    registry = getNpmConfigValue(`${scope}:registry`, cwd);
  }

  if (!registry) {
    registry = getNpmConfigValue('registry', cwd);
  }

  return registry;
}

/**
 * Returns the npm tag that is used for publishing.
 *
 * Note: We can't support @scope:tag because it will always return
 * the default value of 'latest', and there's no way to tell
 * (without parsing npm config ourselves) if that's the npm default
 * that we should override or if the user specifically set it to 'latest'.
 *
 * @param cwd the directory where the npm config should be read from
 */
export function getNpmTag(cwd: string) {
  return getNpmConfigValue('tag', cwd);
}

function getNpmConfigValue(key: string, cwd: string) {
  try {
    const result = execSync(`npm config get ${key}`, {
      cwd,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    return result === 'undefined' ? undefined : result;
  } catch (e) {
    return undefined;
  }
}
