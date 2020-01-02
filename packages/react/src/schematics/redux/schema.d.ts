import { Path } from '@angular-devkit/core';

export interface Schema {
  name: string;
  project: string;
  directory: string;
  appProject: string;
  js?: string;
}

interface NormalizedSchema extends Schema {
  projectType: string;
  projectSourcePath: Path;
  projectModulePath: string;
  appProjectSourcePath: Path;
  appMainFilePath: string;
  filesPath: Path;
  className: string;
  constantName: string;
  propertyName: string;
  fileName: string;
}
