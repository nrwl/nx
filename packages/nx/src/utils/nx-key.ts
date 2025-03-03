import { logger } from './logger';
import { getPackageManagerCommand } from './package-manager';
import { workspaceRoot } from './workspace-root';

export async function printNxKey() {
  try {
    const { organizationName, seatCount, workspaceCount } =
      await getNxKeyInformation();

    logger.log(
      `Nx key licensed to ${organizationName} for ${seatCount} user${
        seatCount > 1 ? 's' : ''
      } in ${
        workspaceCount === 9999 ? 'an unlimited number of' : workspaceCount
      } workspace${workspaceCount > 1 ? 's' : ''}`
    );
  } catch {}
}

export async function getNxKeyInformation() {
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
      `The "@nx/key" package is needed to use Nx Powerpack enabled features. Please install the @nx/key with ${
        getPackageManagerCommand().addDev
      } @nx/key`,
      { cause: e }
    );
  }
}
