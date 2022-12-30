export interface Schema {
  projectName: string;
  destination: string;
  updateImportPath: boolean;
  importPath?: string;
  skipFormat?: boolean;
}
