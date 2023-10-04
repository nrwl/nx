import * as ts from 'typescript';
import { loadTsTransformers } from '../../../utils/typescript/load-ts-transformers';
import type { TransformerEntry } from '../../../utils/typescript/types';

export function getCustomTrasformersFactory(
  transformers: TransformerEntry[]
): (program: ts.Program) => ts.CustomTransformers {
  const { compilerPluginHooks } = loadTsTransformers(transformers);

  return (program: ts.Program): ts.CustomTransformers => ({
    before: compilerPluginHooks.beforeHooks.map(
      (hook) => hook(program) as ts.TransformerFactory<ts.SourceFile>
    ),
    after: compilerPluginHooks.afterHooks.map(
      (hook) => hook(program) as ts.TransformerFactory<ts.SourceFile>
    ),
    afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
      (hook) => hook(program) as ts.TransformerFactory<ts.SourceFile>
    ),
  });
}
