import type * as ts from 'typescript';
import { loadTsTransformers } from '../../../utils/typescript/load-ts-transformers';
import type {
  CompilerPluginHooks,
  TransformerEntry,
} from '../../../utils/typescript/types';

export function getCustomTrasformersFactory(
  transformers: TransformerEntry[]
): (program: ts.Program) => ts.CustomTransformers {
  // Loaded on first use, so a TypeScript setup that can't run transformers
  // fails before importing them.
  let compilerPluginHooks: CompilerPluginHooks | undefined;

  return (program: ts.Program): ts.CustomTransformers => {
    compilerPluginHooks ??=
      loadTsTransformers(transformers).compilerPluginHooks;
    return {
      before: compilerPluginHooks.beforeHooks.map(
        (hook) => hook(program) as ts.TransformerFactory<ts.SourceFile>
      ),
      after: compilerPluginHooks.afterHooks.map(
        (hook) => hook(program) as ts.TransformerFactory<ts.SourceFile>
      ),
      afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
        (hook) => hook(program) as ts.TransformerFactory<ts.SourceFile>
      ),
    };
  };
}
