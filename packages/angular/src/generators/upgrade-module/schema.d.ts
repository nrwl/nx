export interface UpgradeModuleGeneratorOptions {
  name: string;
  project: string;
  router: boolean;
  angularJsImport?: string;
  angularJsCmpSelector?: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
