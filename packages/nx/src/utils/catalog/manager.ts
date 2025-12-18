import type { Tree } from '../../generators/tree';
import type { PnpmWorkspaceYaml } from '../pnpm-workspace';
import type { CatalogReference } from './types';

/**
 * Interface for catalog managers that handle package manager-specific catalog implementations.
 */
export interface CatalogManager {
  readonly name: string;

  isCatalogReference(version: string): boolean;

  parseCatalogReference(version: string): CatalogReference | null;

  getCatalogDefinitionFilePaths(): string[];

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
  ): void;
  validateCatalogReference(
    tree: Tree,
    packageName: string,
    version: string
  ): void;

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
