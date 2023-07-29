export interface Schema {
  projectName: string;
  destination: string;
  importPath?: string;
  updateImportPath: boolean;
  skipFormat?: boolean;
  destinationRelativeToRoot?: boolean;
  newProjectName?: string;
}

export interface NormalizedSchema extends Schema {
  importPath: string;
  relativeToRootDestination: string;
}
