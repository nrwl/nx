export interface Schema {
  name: string;
  path?: string;
  project?: string;
  skipTests?: boolean;
  inlineScam?: boolean;
  flat?: boolean;
  prefix?: string;
  selector?: string;
  export?: boolean;
}
