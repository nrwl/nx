import type {
  Bundle,
  CustomTransformerFactory,
  Program,
  SourceFile,
  TransformerFactory as TypescriptTransformerFactory,
} from 'typescript';

type TransformerFactory =
  | TypescriptTransformerFactory<SourceFile>
  | CustomTransformerFactory;

type DeclarationTransformerFactory =
  | TypescriptTransformerFactory<SourceFile | Bundle>
  | CustomTransformerFactory;

export interface TransformerPlugin {
  name: string;
  options: Record<string, unknown>;
}

export type TransformerEntry = string | TransformerPlugin;

export interface CompilerPlugin {
  before?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => TransformerFactory;
  after?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => TransformerFactory;
  afterDeclarations?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => DeclarationTransformerFactory;
}

/**
 * Extended plugin interface to support different transformer API formats
 * including function-based transformers and direct function exports
 */
export type AnyCompilerPlugin =
  | CompilerPlugin
  | ((
      options?: Record<string, unknown>,
      program?: Program
    ) => TransformerFactory)
  | {
      before: (
        options?: Record<string, unknown>,
        program?: Program
      ) => TransformerFactory;
    }
  | {
      after: (
        options?: Record<string, unknown>,
        program?: Program
      ) => TransformerFactory;
    }
  | {
      afterDeclarations: (
        options?: Record<string, unknown>,
        program?: Program
      ) => DeclarationTransformerFactory;
    };

export interface CompilerPluginHooks {
  beforeHooks: Array<(program?: Program) => TransformerFactory>;
  afterHooks: Array<(program?: Program) => TransformerFactory>;
  afterDeclarationsHooks: Array<
    (program?: Program) => DeclarationTransformerFactory
  >;
}
