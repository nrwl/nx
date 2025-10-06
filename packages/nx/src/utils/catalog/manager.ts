import type { Tree } from '../../generators/tree';
import type { PnpmWorkspaceYaml } from '../pnpm-workspace';
import type { CatalogError, CatalogReference } from './types';

/**
 * Interface for catalog managers that handle package manager-specific catalog implementations.
 */
export interface CatalogManager {
  readonly name: string;
  /**
   * Check if this package manager supports catalogs.
   */
  supportsCatalogs(): boolean;

  isCatalogReference(version: string): boolean;

  parseCatalogReference(version: string): CatalogReference | null;

  /**
   * Get catalog definitions from the workspace.
   */
  getCatalogDefinitions(workspaceRoot: string): PnpmWorkspaceYaml | null;
  getCatalogDefinitions(tree: Tree): PnpmWorkspaceYaml | null;

  /**
   * Resolve a catalog reference to an actual version.
   */
  resolveCatalogReference(
    workspaceRoot: string,
    packageName: string,
    version: string
  ): string | null;
  resolveCatalogReference(
    tree: Tree,
    packageName: string,
    version: string
  ): string | null;

  /**
   * Check that a catalog reference is valid.
   */
  validateCatalogReference(
    workspaceRoot: string,
    packageName: string,
    version: string
  ): { isValid: boolean; error?: CatalogError };
  validateCatalogReference(
    tree: Tree,
    packageName: string,
    version: string
  ): { isValid: boolean; error?: CatalogError };

  /**
   * Updates catalog definitions for specified packages in their respective catalogs.
   */
  updateCatalogVersions(
    tree: Tree,
    updates: Array<{
      packageName: string;
      version: string;
      catalogName?: string;
    }>
  ): void;
  updateCatalogVersions(
    workspaceRoot: string,
    updates: Array<{
      packageName: string;
      version: string;
      catalogName?: string;
    }>
  ): void;
}
