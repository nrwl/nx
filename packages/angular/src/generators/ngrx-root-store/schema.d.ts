export interface Schema {
  project: string;
  minimal: boolean;
  addDevTools?: boolean;
  name?: string;
  directory?: string;
  facade?: boolean;
  skipFormat?: boolean;
  skipImport?: boolean;
  skipPackageJson?: boolean;
}
