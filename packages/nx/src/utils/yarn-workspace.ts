export interface YarnCatalogEntry {
  [packageName: string]: string;
}

export interface YarnWorkspaceYaml {
  catalog?: YarnCatalogEntry;
  catalogs?: Record<string, YarnCatalogEntry>;
}
