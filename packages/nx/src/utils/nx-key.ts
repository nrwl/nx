import { getNxRequirePaths } from './installation-directory';
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
function packageInstalled(name: string): boolean {
  try {
    require.resolve(name, { paths: getNxRequirePaths() });
    return true;
  } catch (e: any) {
    if (e?.code === 'MODULE_NOT_FOUND') return false;
    throw e;
  }
}

export async function getNxKeyInformation(): Promise<NxKey | null> {
  if (packageInstalled('@nx/key')) {
    const { getNxKeyInformationAsync } = await import('@nx/key');
    return getNxKeyInformationAsync(workspaceRoot);
  }
  if (packageInstalled('@nx/powerpack-license')) {
    const {
      getPowerpackLicenseInformation,
      getPowerpackLicenseInformationAsync,
    } = await import('@nx/powerpack-license');
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
