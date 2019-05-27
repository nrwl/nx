export interface Schema {
  name: string;
  project: string;
  style?: string;
  skipTests?: boolean;
  export?: boolean;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
}
