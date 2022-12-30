export interface Schema {
  pluginName: string;
  npmPackageName: string;
  projectDirectory?: string;
  pluginOutputPath?: string;
  jestConfig?: string;
  standaloneConfig?: boolean;
  minimal?: boolean;
}
