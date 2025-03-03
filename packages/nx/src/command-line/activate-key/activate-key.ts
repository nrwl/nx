import { workspaceRoot } from '../../utils/workspace-root';
import { ActivateKeyOptions } from './command-object';
import { prompt } from 'enquirer';
import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../../utils/package-manager';

export async function handleActivateKey(options: ActivateKeyOptions) {
  const key =
    options.key ??
    (await prompt({
      type: 'input',
      name: 'key',
      message: 'Enter your key',
    }));
  const { activateNxKey } = await requireNxKey();
  activateNxKey(workspaceRoot, key);
}

async function requireNxKey(): Promise<any> {
  // @ts-ignore
  return import('@nx/key').catch(async (e) => {
    if ('code' in e && e.code === 'MODULE_NOT_FOUND') {
      try {
        execSync(`${getPackageManagerCommand().addDev} @nx/key@latest`, {
          windowsHide: false,
        });

        // @ts-ignore
        return await import('@nx/key');
      } catch (e) {
        throw new Error(
          'Failed to install @nx/key. Please install @nx/key and try again.'
        );
      }
    }
  });
}
