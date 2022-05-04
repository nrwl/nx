/**
 * Simple utility to get the public name of a package handling arbitrary use cases
 * @param packageName
 * @param prefix
 */
export function getPublicPackageName(
  packageName: string,
  prefix: string = '@nrwl/'
): string {
  /**
   * Core Nx package is not prefixed by "@nrwl/" on NPM
   */
  const isNxCorePackage = packageName === 'nx';
  return isNxCorePackage ? packageName : prefix + packageName;
}
