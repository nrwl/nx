import { execSync } from 'child_process';
import { getPackageManagerCommand } from './package-manager';
import { handleImport } from './handle-import';
import { resolveFromWorkspace } from './installation-directory';

async function importNxKey(): Promise<typeof import('@nx/key')> {
  return handleImport(resolveFromWorkspace('@nx/key'));
}

export async function requireNxKey(): Promise<typeof import('@nx/key')> {
  return importNxKey().catch(async (e) => {
    if ('code' in e && e.code === 'MODULE_NOT_FOUND') {
      try {
        execSync(`${getPackageManagerCommand().addDev} @nx/key@latest`, {
          windowsHide: true,
        });

        return await importNxKey();
      } catch (e) {
        throw new Error(
          'Failed to install @nx/key. Please install @nx/key and try again.'
        );
      }
    }
  });
}
