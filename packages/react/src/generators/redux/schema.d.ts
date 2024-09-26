export interface Schema {
  path: string;
  name?: string;
  appProject?: string;
  js?: string;
}

interface NormalizedSchema extends Schema {
  projectType: string;
  projectDirectory: string;
  projectSourcePath: string;
  projectModulePath: string;
  appProjectSourcePath: string;
  appMainFilePath: string;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
}
