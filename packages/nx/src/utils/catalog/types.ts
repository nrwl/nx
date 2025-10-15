export interface CatalogReference {
  catalogName?: string;
  isDefaultCatalog: boolean;
}

export enum CatalogErrorType {
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  CATALOG_NOT_FOUND = 'CATALOG_NOT_FOUND',
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
  INVALID_CATALOGS_CONFIGURATION = 'INVALID_CATALOGS_CONFIGURATION',
}

export interface CatalogError {
  type: CatalogErrorType;
  message: string;
  catalogName?: string;
  packageName?: string;
  suggestions?: string[];
}
