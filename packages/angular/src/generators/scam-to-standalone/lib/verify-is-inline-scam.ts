import { selectorExistsInAST } from './selector-exists-in-ast';
import type { SourceFile } from 'typescript';

export function verifyIsInlineScam(componentAST: SourceFile) {
  const NGMODULE_DECORATOR_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=NgModule])';
  const COMPONENT_DECORATOR_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=Component])';

  return (
    selectorExistsInAST(COMPONENT_DECORATOR_SELECTOR, componentAST) &&
    selectorExistsInAST(NGMODULE_DECORATOR_SELECTOR, componentAST)
  );
}
