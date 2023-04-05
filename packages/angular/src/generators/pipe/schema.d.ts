export interface Schema {
  name: string;
  project: string;
  path?: string;
  flat?: boolean;
  skipTests?: boolean;
  skipImport?: boolean;
  standalone?: boolean;
  module?: string;
  export?: boolean;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  path: string;
}
