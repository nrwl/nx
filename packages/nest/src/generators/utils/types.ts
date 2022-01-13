export type Language = 'js' | 'ts';
export type UnitTestRunner = 'jest' | 'none';
export type NestSchematic =
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
  | 'resource'
  | 'service';
export type TransportLayer =
  | 'rest'
  | 'graphql-code-first'
  | 'graphql-schema-first'
  | 'microservice'
  | 'ws';

export type NestGeneratorOptions = {
  name: string;
  project: string;
  directory?: string;
  flat?: boolean;
  skipFormat?: boolean;
};

export type NestGeneratorWithLanguageOption = NestGeneratorOptions & {
  language?: Language;
};

export type NestGeneratorWithTestOption = NestGeneratorOptions & {
  unitTestRunner?: UnitTestRunner;
};

export type NestGeneratorWithResourceOption = NestGeneratorOptions & {
  type?: TransportLayer;
  crud?: boolean;
};

export type NormalizedOptions = {
  name: string;
  sourceRoot: string;
  flat?: boolean;
  language?: 'js' | 'ts';
  module?: string;
  path?: string;
  skipFormat?: boolean;
  skipImport?: boolean;
  spec?: boolean;
};
