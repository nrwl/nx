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

export async function getNxKeyInformation(): Promise<NxKey | null> {
  try {
    const {
      getPowerpackLicenseInformation,
      getPowerpackLicenseInformationAsync,
    } = (await import(
      '@nx/powerpack-license'
    )) as typeof import('@nx/powerpack-license');
    return (
      getPowerpackLicenseInformationAsync ?? getPowerpackLicenseInformation
    )(workspaceRoot);
  } catch (e) {
    try {
      const { getNxKeyInformationAsync } = (await import(
        '@nx/key'
      )) as typeof import('@nx/key');
      return getNxKeyInformationAsync(workspaceRoot);
    } catch (e) {
      if ('code' in e && e.code === 'MODULE_NOT_FOUND') {
        throw new NxKeyNotInstalledError(e);
      }
      throw e;
    }
  }
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
