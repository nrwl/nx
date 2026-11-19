import type { Tree } from '../../generators/tree';
import type {
  CatalogDefinitions,
  CatalogReference,
  CatalogReferenceMatch,
} from './types';

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
 * Shared implementation of getCatalogReferencesForPackage: enumerates the
 * default and named catalog references and keeps those the manager resolves,
 * so per-manager default-catalog semantics apply without duplication.
 */
export function collectCatalogReferencesForPackage(
  manager: CatalogManager,
  treeOrRoot: Tree | string,
  packageName: string
): CatalogReferenceMatch[] {
  // The overload pairs don't accept the Tree | string union directly.
  const source = treeOrRoot as string;
  const catalogDefs = manager.getCatalogDefinitions(source);
  if (!catalogDefs) {
    return [];
  }

  const catalogRefs = ['catalog:'];
  for (const name of Object.keys(catalogDefs.catalogs ?? {})) {
    // Skip names the manager treats as the default catalog (e.g. pnpm's
    // "default") — already covered by the `catalog:` candidate.
    if (!manager.parseCatalogReference(`catalog:${name}`)?.isDefaultCatalog) {
      catalogRefs.push(`catalog:${name}`);
    }
  }

  const matches: CatalogReferenceMatch[] = [];
  for (const catalogRef of catalogRefs) {
    const versionSpec = manager.resolveCatalogReference(
      source,
      packageName,
      catalogRef
    );
    if (versionSpec) {
      matches.push({ catalogRef, versionSpec });
    }
  }
  return matches;
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
   * Get every catalog reference that resolves to a version for a package,
   * following the package manager's own default-catalog semantics.
   */
  getCatalogReferencesForPackage(
    workspaceRoot: string,
    packageName: string
  ): CatalogReferenceMatch[];
  getCatalogReferencesForPackage(
    tree: Tree,
    packageName: string
  ): CatalogReferenceMatch[];

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
