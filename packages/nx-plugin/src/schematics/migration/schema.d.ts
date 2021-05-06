export interface Schema {
  project: string;
  name: string;
  description: string;
  version: string;
  packageJsonUpdates: boolean;
}

export interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectSourceRoot: string;
}
