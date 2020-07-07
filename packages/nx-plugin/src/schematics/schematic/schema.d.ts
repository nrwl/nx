export interface Schema {
  project: string;
  name: string;
  description?: string;
  unitTestRunner: 'jest' | 'none';
}

export interface NormalizedSchema extends Schema {
  fileName: string;
  projectRoot: string;
  projectSourceRoot: string;
  npmScope: string;
  npmPackageName: string;
  fileTemplate: string;
}
