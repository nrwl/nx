export interface ConfigurationGeneratorSchema {
  project: string;
  directory: string;
  js: boolean; // default is false
  skipFormat: boolean;
  skipPackageJson: boolean;
}
