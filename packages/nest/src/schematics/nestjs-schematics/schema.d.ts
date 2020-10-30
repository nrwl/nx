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
  path?: string;
  flat: boolean;
  // Additional Nest schematic properties
  module?: string;
  skipImport?: string;
  language?: string;
  spec?: boolean;
}
