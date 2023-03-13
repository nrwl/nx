export interface Schema {
  name: string;
  project: string;
  path?: string;
  prefix?: string;
  skipTests?: boolean;
  skipImport?: boolean;
  selector?: string;
  standalone?: boolean;
  flat?: boolean;
  module?: string;
  export?: boolean;
  skipFormat?: boolean;
}
