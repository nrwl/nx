export interface Schema {
  name: string;
  project: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  pascalCaseFiles?: boolean;
  pascalCaseDirectory?: boolean;
  routing?: boolean;
  js?: boolean;
  flat?: boolean;
  fileName?: string;
  inSourceTests?: boolean;
  skipFormat?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
}

export interface NormalizedSchema extends Schema {
  projectSourceRoot: string;
  fileName: string;
  className: string;
  filePath: string;
}
