export interface Schema {
  name: string;
  project: string;
  style?: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  js?: boolean;
  flat?: boolean;
}
