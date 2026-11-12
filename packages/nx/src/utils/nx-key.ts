import { pathToFileURL } from 'url';
import {
  getNxRequirePaths,
  resolveInstalledPackage,
} from './installation-directory';
import { getPackageManagerCommand } from './package-manager';
import { workspaceRoot } from './workspace-root';
import type { NxKey } from '@nx/key';

export function createNxKeyLicenseeInformation(nxKey: NxKey) {
  if ('isPowerpack' in nxKey && nxKey.isPowerpack) {
    return `Licensed to ${nxKey.organizationName} for ${nxKey.seatCount} user${
      nxKey.seatCount > 1 ? 's' : ''
    } in ${
      nxKey.workspaceCount === 9999
        ? 'an unlimited number of'
        : nxKey.workspaceCount
    } workspace${nxKey.workspaceCount > 1 ? 's' : ''}.`;
  } else {
    return `Licensed to ${nxKey.organizationName}.`;
  }
}

// `await handleImport` walks node_modules and pays ~25ms per miss; `resolve`
// is just the filesystem lookup and is microseconds when the package is absent.
// Only treat MODULE_NOT_FOUND as "not installed" so unrelated errors (permission,
// corrupt package.json, etc.) still surface instead of being silently hidden.
function resolveInstalled(name: string): string | null {
  try {
    return pathToFileURL(resolveInstalledPackage(name, getNxRequirePaths()))
      .href;
  } catch (e: any) {
    if (e?.code === 'MODULE_NOT_FOUND') return null;
    throw e;
  }
}

export async function getNxKeyInformation(): Promise<NxKey | null> {
  const nxKeyUrl = resolveInstalled('@nx/key');
  if (nxKeyUrl) {
    const { getNxKeyInformationAsync }: typeof import('@nx/key') = await import(
      nxKeyUrl
    );
    return getNxKeyInformationAsync(workspaceRoot);
  }
  const powerpackLicenseUrl = resolveInstalled('@nx/powerpack-license');
  if (powerpackLicenseUrl) {
    const {
      getPowerpackLicenseInformation,
      getPowerpackLicenseInformationAsync,
    } = await import(powerpackLicenseUrl);
    return (
      getPowerpackLicenseInformationAsync ?? getPowerpackLicenseInformation
    )(workspaceRoot);
  }
  throw new NxKeyNotInstalledError(new Error('MODULE_NOT_FOUND'));
}

export class NxKeyNotInstalledError extends Error {
  constructor(e: Error) {
    super(
      `The "@nx/key" package is needed to use Nx key enabled features. Please install it with ${
        getPackageManagerCommand().addDev
      } @nx/key`,
      { cause: e }
    );
  }
}
