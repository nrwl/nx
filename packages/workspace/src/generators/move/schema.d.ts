export interface Schema {
  projectName: string;
  destination: string;
  importPath?: string;
  updateImportPath: boolean;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  importPath: string;
  newProjectName: string;
  relativeToRootDestination: string;
}
