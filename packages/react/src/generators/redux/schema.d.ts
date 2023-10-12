export interface Schema {
  name: string;
  project: string;
  directory?: string;
  appProject?: string;
  js?: string;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
}

interface NormalizedSchema extends Schema {
  projectType: string;
  projectSourcePath: string;
  projectModulePath: string;
  appProjectSourcePath: string;
  appMainFilePath: string;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
}
