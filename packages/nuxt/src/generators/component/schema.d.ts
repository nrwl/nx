export interface Schema {
  project: string;
  name: string;
  skipTests?: boolean;
  flat?: boolean;
  pascalCaseFiles?: boolean;
  pascalCaseDirectory?: boolean;
  fileName?: string;
  inSourceTests?: boolean;
  skipFormat?: boolean;
  directory?: string;
}
