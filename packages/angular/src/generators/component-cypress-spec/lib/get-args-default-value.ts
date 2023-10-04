import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { PropertyDeclaration } from 'typescript';

let tsModule: typeof import('typescript');

export function getArgsDefaultValue(
  property: PropertyDeclaration
): string | undefined {
  if (!property.initializer) {
    return undefined;
  }
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  switch (property.initializer.kind) {
    case tsModule.SyntaxKind.StringLiteral:
      const returnString = property.initializer.getText().slice(1, -1);
      return returnString.replace(/\s/g, '+');
    case tsModule.SyntaxKind.NumericLiteral:
    case tsModule.SyntaxKind.TrueKeyword:
    case tsModule.SyntaxKind.FalseKeyword:
      return property.initializer.getText();
    default:
      return undefined;
  }
}
