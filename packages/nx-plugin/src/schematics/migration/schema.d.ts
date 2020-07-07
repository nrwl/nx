export interface Schema {
  project: string;
  name: string;
  description: string;
  version: string;
  packageJsonUpdates: boolean;
  unitTestRunner: 'jest' | 'none';
}

export interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectSourceRoot: string;
}
