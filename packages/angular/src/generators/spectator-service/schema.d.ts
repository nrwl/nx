export interface Schema {
  name: string;
  project: string;
  path?: string;
  skipTests?: boolean;
  jest?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  filePath: string;
  projectSourceRoot: string;
  projectRoot: string;
}
