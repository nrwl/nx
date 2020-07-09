export interface NestSchematicsSchema {
  type:
    | 'class'
    | 'controller'
    | 'decorator'
    | 'filter'
    | 'gateway'
    | 'guard'
    | 'interceptor'
    | 'interface'
    | 'middleware'
    | 'module'
    | 'pipe'
    | 'provider'
    | 'resolver'
    | 'service';
  name: string;
  project: string;
  unitTestRunner: 'jest' | 'none';
  directory?: string;
  // Nest schematics properties
  path?: string;
  module?: string;
  skipImport?: string;
  flat?: boolean;
  language?: string;
  spec?: boolean;
}
