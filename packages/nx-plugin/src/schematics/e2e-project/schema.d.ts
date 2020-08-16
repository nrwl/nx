export interface Schema {
  pluginName: string;
  projectDirectory: string;
  npmPackageName: string;
  pluginOutputPath: string;
  jestConfig: string;
  tsSpecConfig: string;
}

export interface NxPluginE2ESchema extends Schema {
  projectRoot: string;
  projectName: string;
  pluginPropertyName: string;
  npmScope: string;
}
