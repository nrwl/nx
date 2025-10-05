export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  skipImport?: boolean;
  standalone?: boolean;
  module?: string;
  export?: boolean;
  typeSeparator?: string;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  filePath: string;
  projectName: string;
  fileName: string;
  symbolName: string;
}
