import { detectPackageManager } from 'nx/src/devkit-exports';
import type { CatalogManager } from './manager';
import { PnpmCatalogManager } from './pnpm-manager';
import {
  BunCatalogManager,
  NpmCatalogManager,
  UnknownCatalogManager,
  YarnCatalogManager,
} from './unsupported-manager';

/**
 * Factory function to get the appropriate catalog manager based on the package manager
 */
export function getCatalogManager(workspaceRoot: string): CatalogManager {
  const packageManager = detectPackageManager(workspaceRoot);

  switch (packageManager) {
    case 'pnpm':
      return new PnpmCatalogManager();
    case 'npm':
      return new NpmCatalogManager();
    case 'yarn':
      return new YarnCatalogManager();
    case 'bun':
      return new BunCatalogManager();
    default:
      return new UnknownCatalogManager();
  }
}
