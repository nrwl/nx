export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  inlineScam?: boolean;
  export?: boolean;
  typeSeparator?: string;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  name: string;
  directory: string;
  export: boolean;
  fileName: string;
  filePath: string;
  inlineScam: boolean;
  projectName: string;
  symbolName: string;
  modulePath: string;
}
