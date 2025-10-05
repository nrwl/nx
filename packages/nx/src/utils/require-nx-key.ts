import { execSync } from 'child_process';
import { getPackageManagerCommand } from './package-manager';

export async function requireNxKey(): Promise<typeof import('@nx/key')> {
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
