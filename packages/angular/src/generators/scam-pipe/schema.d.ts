export interface Schema {
  name: string;
  path?: string;
  project?: string;
  skipTests?: boolean;
  inlineScam?: boolean;
  flat?: boolean;
  export?: boolean;
}
