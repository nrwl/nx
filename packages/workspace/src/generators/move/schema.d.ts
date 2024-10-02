export interface Schema {
  projectName: string;
  destination: string;
  importPath?: string;
  updateImportPath: boolean;
  skipFormat?: boolean;
  newProjectName?: string;
}

export interface NormalizedSchema extends Schema {
  relativeToRootDestination: string;
}
