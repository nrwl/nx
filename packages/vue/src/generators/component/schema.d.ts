export interface ComponentGeneratorSchema {
  path: string;
  name?: string;
  skipTests?: boolean;
  export?: boolean;
  routing?: boolean;
  js?: boolean;
  fileName?: string;
  inSourceTests?: boolean;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends ComponentGeneratorSchema {
  directory: string;
  projectName: string;
  projectSourceRoot: string;
  fileName: string;
  className: string;
  filePath: string;
}
