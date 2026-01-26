export interface InitGeneratorSchema {
  skipFormat?: boolean;
  setupPathsPlugin?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
  vitestOnly?: boolean;
  useViteV5?: boolean;
  useViteV6?: boolean;
  projectRoot?: string;
}
