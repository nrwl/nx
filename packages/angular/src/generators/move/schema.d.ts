export interface Schema {
  projectName: string;
  destination: string;
  updateImportPath: boolean;
  importPath?: string;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  oldProjectRoot: string;
  newProjectName: string;
}
