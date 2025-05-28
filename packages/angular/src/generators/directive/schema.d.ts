export interface Schema {
  path: string;
  name?: string;
  prefix?: string;
  skipTests?: boolean;
  skipImport?: boolean;
  selector?: string;
  standalone?: boolean;
  module?: string;
  export?: boolean;
  type?: string;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  filePath: string;
  fileName: string;
  symbolName: string;
  projectName: string;
}
