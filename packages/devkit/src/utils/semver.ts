import { valid } from 'semver';

export function checkAndCleanWithSemver(
  pkgName: string,
  version: string
): string {
  let newVersion = version;

  const isPnpmCatalog = newVersion.startsWith('catalog:');
  if (valid(newVersion) || isPnpmCatalog) {
    return newVersion;
  }

  if (!valid(newVersion)) {
    throw new Error(
      `The package.json lists a version of ${pkgName} that Nx is unable to validate - (${version})`
    );
  }

  return newVersion;
}
