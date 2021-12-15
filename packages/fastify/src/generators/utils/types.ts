export type Language = 'js' | 'ts';
export type UnitTestRunner = 'jest' | 'none';

export type FastifyGeneratorOptions = {
  name: string;
  project: string;
  directory?: string;
  flat?: boolean;
  skipFormat?: boolean;
};

export type FastifyGeneratorWithLanguageOption = FastifyGeneratorOptions & {
  language?: Language;
};

export type FastifyGeneratorWithTestOption = FastifyGeneratorOptions & {
  unitTestRunner?: UnitTestRunner;
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
