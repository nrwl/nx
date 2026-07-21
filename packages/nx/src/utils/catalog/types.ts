export interface CatalogReference {
  catalogName?: string;
  isDefaultCatalog: boolean;
}

export interface CatalogReferenceMatch {
  catalogRef: string;
  versionSpec: string;
}

export interface CatalogEntry {
  [packageName: string]: string;
}

export interface CatalogDefinitions {
  catalog?: CatalogEntry;
  catalogs?: Record<string, CatalogEntry>;
}
