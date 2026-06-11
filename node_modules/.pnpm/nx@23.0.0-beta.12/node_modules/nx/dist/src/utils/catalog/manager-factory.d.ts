import type { CatalogManager } from './manager';
/**
 * Factory function to get the appropriate catalog manager based on the package manager
 */
export declare function getCatalogManager(workspaceRoot: string): CatalogManager | null;
