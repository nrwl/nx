export interface WebConfigurationGeneratorSchema {
  project: string;
  bundler: 'vite' | 'webpack';
  skipFormat?: boolean;
  skipPackageJson?: boolean; //default is false
}
