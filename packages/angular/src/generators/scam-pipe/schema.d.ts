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
  export: boolean;
  flat: boolean;
  inlineScam: boolean;
  path: string;
  projectSourceRoot: string;
}
