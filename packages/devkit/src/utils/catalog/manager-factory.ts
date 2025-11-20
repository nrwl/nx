import { detectPackageManager } from 'nx/src/devkit-exports';
import type { CatalogManager } from './manager';
import { PnpmCatalogManager } from './pnpm-manager';

/**
 * Factory function to get the appropriate catalog manager based on the package manager
 */
export function getCatalogManager(
  workspaceRoot: string
): CatalogManager | null {
  const packageManager = detectPackageManager(workspaceRoot);

  switch (packageManager) {
    case 'pnpm':
      return new PnpmCatalogManager();
    default:
      return null;
  }
}
