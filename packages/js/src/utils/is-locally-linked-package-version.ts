import {
  detectPackageManager,
  getPackageManagerVersion,
  PackageManager,
} from '@nx/devkit';
// import { lt } from 'semver';

let pm: PackageManager | undefined;
// let pmVersion: string | undefined;

const localPackageProtocols = [
  'file:', // all package managers
  'workspace:', // not npm
  // TODO: Support portal protocol at the project graph level before enabling here
  // 'portal:', // modern yarn only
];

export function isLocallyLinkedPackageVersion(version: string): boolean {
  // Not using a supported local protocol
  if (!localPackageProtocols.some((protocol) => version.startsWith(protocol))) {
    return false;
  }
  // Supported by all package managers
  if (version.startsWith('file:')) {
    return true;
  }
  // Determine specific package manager in use
  if (!pm) {
    pm = detectPackageManager();
    // pmVersion = getPackageManagerVersion(pm);
  }
  if (pm === 'npm' && version.startsWith('workspace:')) {
    throw new Error(
      `The "workspace:" protocol is not yet supported by npm (https://github.com/npm/rfcs/issues/765). Please ensure you have a valid setup according to your package manager before attempting to release packages.`
    );
  }
  // TODO: Support portal protocol at the project graph level before enabling here
  // if (
  //   version.startsWith('portal:') &&
  //   (pm !== 'yarn' || lt(pmVersion, '2.0.0'))
  // ) {
  //   throw new Error(
  //     `The "portal:" protocol is only supported by yarn@2.0.0 and above. Please ensure you have a valid setup according to your package manager before attempting to release packages.`
  //   );
  // }
  return true;
}
