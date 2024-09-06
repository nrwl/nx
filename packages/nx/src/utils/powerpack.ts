import { logger } from './logger';
import { getPackageManagerCommand } from './package-manager';
import { workspaceRoot } from './workspace-root';

export async function printPowerpackLicense() {
  try {
    const { organizationName, seatCount, workspaceCount } =
      await getPowerpackLicenseInformation();

    logger.log(
      `Nx Powerpack Licensed to ${organizationName} for ${seatCount} user${
        seatCount > 1 ? '' : 's'
      } in ${workspaceCount} workspace${workspaceCount > 1 ? '' : 's'}`
    );
  } catch {}
}

export async function getPowerpackLicenseInformation() {
  try {
    const { getPowerpackLicenseInformation } = (await import(
      // @ts-ignore
      '@nx/powerpack-license'
      // TODO(@FrozenPandaz): Provide the right type here.
    )) as any;
    // )) as typeof import('@nx/powerpack-license');
    return getPowerpackLicenseInformation(workspaceRoot);
  } catch (e) {
    if ('code' in e && e.code === 'ERR_MODULE_NOT_FOUND') {
      throw new NxPowerpackNotInstalledError(e);
    }
    throw e;
  }
}

export class NxPowerpackNotInstalledError extends Error {
  constructor(e: Error) {
    super(
      `The "@nx/powerpack-license" package is needed to use Nx Powerpack enabled features. Please install the @nx/powerpack-license with ${
        getPackageManagerCommand().addDev
      } @nx/powerpack-license`,
      { cause: e }
    );
  }
}
