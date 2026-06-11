import type { Tree } from '../../generators/tree';
import { type CatalogManager } from './manager';
import type { CatalogDefinitions, CatalogReference } from './types';
/**
 * Yarn Berry (v4+) catalog manager implementation
 */
export declare class YarnCatalogManager implements CatalogManager {
    readonly name = "yarn";
    readonly catalogProtocol = "catalog:";
    isCatalogReference(version: string): boolean;
    parseCatalogReference(version: string): CatalogReference | null;
    getCatalogDefinitionFilePaths(): string[];
    getCatalogDefinitions(treeOrRoot: Tree | string): CatalogDefinitions | null;
    resolveCatalogReference(treeOrRoot: Tree | string, packageName: string, version: string): string | null;
    validateCatalogReference(treeOrRoot: Tree | string, packageName: string, version: string): void;
    updateCatalogVersions(treeOrRoot: Tree | string, updates: Array<{
        packageName: string;
        version: string;
        catalogName?: string;
    }>): void;
}
