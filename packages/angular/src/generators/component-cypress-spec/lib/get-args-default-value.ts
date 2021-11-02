import type { PropertyDeclaration } from 'typescript';
import { SyntaxKind } from 'typescript';

export function getArgsDefaultValue(
  property: PropertyDeclaration
): string | undefined {
  if (!property.initializer) {
    return undefined;
  }
  switch (property.initializer.kind) {
    case SyntaxKind.StringLiteral:
      const returnString = property.initializer.getText().slice(1, -1);
      return returnString.replace(/\s/g, '+');
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
      return property.initializer.getText();
    default:
      return undefined;
  }
}
