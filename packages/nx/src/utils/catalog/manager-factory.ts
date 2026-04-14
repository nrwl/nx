import { detectPackageManager } from '../package-manager';
import type { CatalogManager } from './manager';
import { PnpmCatalogManager } from './pnpm-manager';
import { YarnCatalogManager } from './yarn-manager';

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
    case 'yarn':
      return new YarnCatalogManager();
    default:
      return null;
  }
}
