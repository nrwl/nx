import type { Tree } from '../../generators/tree';
import type { PnpmWorkspaceYaml } from '../pnpm-workspace';
import { CatalogUnsupportedError } from './errors';
import type { CatalogManager } from './manager';
import type { CatalogError, CatalogReference } from './types';

/**
 * Base catalog manager for package managers that don't support catalogs
 */
abstract class UnsupportedCatalogManager implements CatalogManager {
  abstract readonly name: string;

  supportsCatalogs(): boolean {
    return false;
  }

  isCatalogReference(_version: string): boolean {
    return false;
  }

  parseCatalogReference(_version: string): CatalogReference | null {
    return null;
  }

  getCatalogDefinitions(_treeOrRoot: Tree | string): PnpmWorkspaceYaml | null {
    throw new CatalogUnsupportedError(this.name, 'get catalog definitions');
  }

  resolveCatalogReference(
    _treeOrRoot: Tree | string,
    _packageName: string,
    _version: string
  ): string | null {
    throw new CatalogUnsupportedError(this.name, 'resolve catalog references');
  }

  validateCatalogReference(
    _treeOrRoot: Tree | string,
    _packageName: string,
    _version: string
  ): { isValid: boolean; error?: CatalogError } {
    throw new CatalogUnsupportedError(this.name, 'validate catalog references');
  }

  updateCatalogVersions(
    _treeOrRoot: Tree | string,
    _updates: Array<{
      packageName: string;
      version: string;
      catalogName?: string;
    }>
  ): void {
    throw new CatalogUnsupportedError(this.name, 'update catalog versions');
  }
}

export class YarnCatalogManager extends UnsupportedCatalogManager {
  readonly name = 'yarn';
}

export class BunCatalogManager extends UnsupportedCatalogManager {
  readonly name = 'bun';
}

export class NpmCatalogManager extends UnsupportedCatalogManager {
  readonly name = 'npm';
}

export class UnknownCatalogManager extends UnsupportedCatalogManager {
  readonly name = 'unknown';
}
