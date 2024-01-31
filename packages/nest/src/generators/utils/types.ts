import { NameAndDirectoryFormat } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

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
  directory?: string;
  skipFormat?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;

  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. It will be removed in Nx v19.
   */
  flat?: boolean;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v19.
   */
  project?: string;
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
