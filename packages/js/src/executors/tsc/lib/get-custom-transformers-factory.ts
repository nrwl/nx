import * as ts from 'typescript';
import { loadTsTransformers } from '../../../utils/typescript/load-ts-transformers';
import type { TransformerEntry } from '../../../utils/typescript/types';

export function getCustomTrasformersFactory(
  transformers: TransformerEntry[]
): (program?: ts.Program) => ts.CustomTransformers {
  const { compilerPluginHooks } = loadTsTransformers(transformers);

  return (program?: ts.Program): ts.CustomTransformers => ({
    before: compilerPluginHooks.beforeHooks.map((hook) => hook(program)),
    after: compilerPluginHooks.afterHooks.map((hook) => hook(program)),
    afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map((hook) =>
      hook(program)
    ),
  });
}
