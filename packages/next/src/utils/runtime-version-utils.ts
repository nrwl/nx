import { clean, coerce, major } from 'semver';
import { readJsonFile } from '@nx/devkit';

/**
 * Get the installed Next.js major version at runtime without requiring a Tree object.
 * This is useful for executors that need to detect the Next.js version during execution.
 *
 * @returns The major version number of the installed Next.js package, or null if not found
 */
export function getInstalledNextVersionRuntime(): number | null {
  try {
    const nextPackageJsonPath = require.resolve('next/package.json', {
      paths: [process.cwd()],
    });
    const nextPackageJson = readJsonFile(nextPackageJsonPath);
    const cleanedVersion =
      clean(nextPackageJson.version) ??
      coerce(nextPackageJson.version)?.version;
    if (!cleanedVersion) {
      return null;
    }
    return major(cleanedVersion);
  } catch {
    return null;
  }
}
