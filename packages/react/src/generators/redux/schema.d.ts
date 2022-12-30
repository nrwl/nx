export interface Schema {
  name: string;
  project: string;
  directory?: string;
  appProject?: string;
  js?: string;
}

interface NormalizedSchema extends Schema {
  projectType: string;
  projectSourcePath: string;
  projectModulePath: string;
  appProjectSourcePath: string;
  appMainFilePath: string;
  filesPath: string;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
}
