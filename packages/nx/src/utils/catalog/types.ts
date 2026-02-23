export interface CatalogReference {
  catalogName?: string;
  isDefaultCatalog: boolean;
}

export interface CatalogDefinitions {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}
