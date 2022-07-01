export interface Schema {
  name: string;
  path?: string;
  project?: string;
  skipTests?: boolean;
  inlineScam?: boolean;
  flat?: boolean;
  export?: boolean;
}

export interface NormalizedSchema extends Schema {
  flat: boolean;
  path: string;
  project: string;
  projectSourceRoot: string;
}
