export interface SetupOxlintBridgeSchema {
  skipPackageJson?: boolean;
  skipFormat?: boolean;
  keepExistingVersions?: boolean;
  oxlintConfigPath?: string;
}
