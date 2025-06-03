import type {
  CustomTransformerFactory,
  Node,
  Program,
  TransformerFactory as TypescriptTransformerFactory,
} from 'typescript';

type TransformerFactory =
  | TypescriptTransformerFactory<Node>
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
  ) => TransformerFactory;
}

/**
 * Extended plugin interface to support different transformer API formats
 * including NestJS-style transformers and direct function exports
 */
export type AnyCompilerPlugin = 
  | CompilerPlugin
  | ((options?: Record<string, unknown>, program?: Program) => TransformerFactory)
  | { before: (options?: Record<string, unknown>, program?: Program) => TransformerFactory }
  | { after: (options?: Record<string, unknown>, program?: Program) => TransformerFactory }
  | { afterDeclarations: (options?: Record<string, unknown>, program?: Program) => TransformerFactory };

export interface CompilerPluginHooks {
  beforeHooks: Array<(program?: Program) => TransformerFactory>;
  afterHooks: Array<(program?: Program) => TransformerFactory>;
  afterDeclarationsHooks: Array<(program?: Program) => TransformerFactory>;
}
