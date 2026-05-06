import { logger } from './logger';
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

export async function printNxKey() {
  try {
    const key = await getNxKeyInformation();
    if (key) {
      logger.log(createNxKeyLicenseeInformation(key));
    }
  } catch {}
}

// `await handleImport` walks node_modules and pays ~25ms per miss; `resolve`
// is just the filesystem lookup and is microseconds when the package is absent.
function packageInstalled(name: string): boolean {
  try {
    require.resolve(name, { paths: [workspaceRoot] });
    return true;
  } catch {
    return false;
  }
}

export async function getNxKeyInformation(): Promise<NxKey | null> {
  if (packageInstalled('@nx/powerpack-license')) {
    const {
      getPowerpackLicenseInformation,
      getPowerpackLicenseInformationAsync,
    } = await import('@nx/powerpack-license');
    return (
      getPowerpackLicenseInformationAsync ?? getPowerpackLicenseInformation
    )(workspaceRoot);
  }
  if (packageInstalled('@nx/key')) {
    const { getNxKeyInformationAsync } = await import('@nx/key');
    return getNxKeyInformationAsync(workspaceRoot);
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
