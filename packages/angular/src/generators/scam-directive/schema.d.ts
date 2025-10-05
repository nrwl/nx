export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  inlineScam?: boolean;
  prefix?: string;
  selector?: string;
  export?: boolean;
  type?: string;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  name: string;
  directory: string;
  export: boolean;
  fileName: string;
  filePath: string;
  inlineScam: boolean;
  symbolName: string;
  projectName: string;
  modulePath: string;
}
