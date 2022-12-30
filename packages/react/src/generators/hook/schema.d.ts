export interface Schema {
  name: string;
  project: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  pascalCaseFiles?: boolean;
  pascalCaseDirectory?: boolean;
  flat?: boolean;
  js?: boolean;
}
