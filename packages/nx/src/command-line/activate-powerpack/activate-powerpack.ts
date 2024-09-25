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
  const { activatePowerpack } = await requirePowerpack();
  activatePowerpack(workspaceRoot, license);
}

async function requirePowerpack(): Promise<any> {
  // @ts-ignore
  return import('@nx/powerpack-license').catch(async (e) => {
    if ('code' in e && e.code === 'MODULE_NOT_FOUND') {
      try {
        execSync(
          `${getPackageManagerCommand().addDev} @nx/powerpack-license@latest`,
          {
            windowsHide: true,
          }
        );

        // @ts-ignore
        return await import('@nx/powerpack-license');
      } catch (e) {
        throw new Error(
          'Failed to install @nx/powerpack-license. Please install @nx/powerpack-license and try again.'
        );
      }
    }
  });
}
