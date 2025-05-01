export interface Schema {
  name: string;
  minimal: boolean;
  parent: string;
  directory: string;
  route?: string;
  barrels?: boolean;
  facade?: boolean;
  skipFormat?: boolean;
  skipImport?: boolean;
  skipPackageJson?: boolean;
}
