import type { Tree } from 'nx/src/devkit-exports';
import type { CatalogDefinitions, CatalogReference } from './types';

export function formatCatalogError(
  error: string,
  suggestions: string[]
): string {
  let message = error;

  if (suggestions.length > 0) {
    message += '\n\nSuggestions:';
    suggestions.forEach((suggestion) => {
      message += `\n  • ${suggestion}`;
    });
  }

  return message;
}

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
  getCatalogDefinitions(workspaceRoot: string): CatalogDefinitions | null;
  getCatalogDefinitions(tree: Tree): CatalogDefinitions | null;

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
