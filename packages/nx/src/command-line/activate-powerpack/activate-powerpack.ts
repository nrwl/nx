import { workspaceRoot } from '../../utils/workspace-root';
import { ActivatePowerpackOptions } from './command-object';
import { prompt } from 'enquirer';
import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../../utils/package-manager';

export async function handleActivatePowerpack(
  options: ActivatePowerpackOptions
) {
  const license =
    options.license ??
    (await prompt({
      type: 'input',
      name: 'license',
      message: 'Enter your License Key',
    }));
  const { activatePowerpack } = requirePowerpack();
  activatePowerpack(workspaceRoot, license);
}

function requirePowerpack(): any {
  try {
    return require('@nx/powerpack-license');
  } catch (e) {
    if ('code' in e && e.code === 'MODULE_NOT_FOUND') {
      try {
        execSync(`${getPackageManagerCommand().addDev} @nx/powerpack-license`);

        // @ts-ignore
        return import('@nx/powerpack-license');
      } catch (e) {
        throw new Error(
          'Failed to install @nx/powerpack-license. Please install @nx/powerpack-license and try again.'
        );
      }
    }
  }
}
