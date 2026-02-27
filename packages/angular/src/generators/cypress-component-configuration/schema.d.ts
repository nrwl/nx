export interface CypressComponentConfigSchema {
  project: string;
  generateTests: boolean;
  skipFormat?: boolean;
  buildTarget?: string;
  skipPackageJson?: boolean;
}
