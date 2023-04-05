export interface Schema {
  name: string;
  project: string;
  path?: string;
  skipTests?: boolean;
  inlineScam?: boolean;
  flat?: boolean;
  export?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  export: boolean;
  fileName: string;
  filePath: string;
  flat: boolean;
  inlineScam: boolean;
  path: string;
}
