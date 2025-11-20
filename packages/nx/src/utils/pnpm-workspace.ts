export interface PnpmCatalogEntry {
  [packageName: string]: string;
}

export interface PnpmWorkspaceYaml {
  packages?: string[];
  catalog?: PnpmCatalogEntry;
  catalogs?: Record<string, PnpmCatalogEntry>;
}
