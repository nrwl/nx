export interface Schema {
  projectName: string;
  destination: string;
  importPath?: string;
  updateImportPath: boolean;
  skipFormat?: boolean;
}
