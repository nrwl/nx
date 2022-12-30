export interface DowngradeModuleGeneratorOptions {
  name: string;
  project: string;
  angularJsImport?: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
