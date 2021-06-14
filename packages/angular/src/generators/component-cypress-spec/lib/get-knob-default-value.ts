import type { PropertyDeclaration } from 'typescript';
import { SyntaxKind } from 'typescript';

export function getKnobDefaultValue(
  property: PropertyDeclaration
): string | undefined {
  if (!property.initializer) {
    return undefined;
  }
  switch (property.initializer.kind) {
    case SyntaxKind.StringLiteral:
      return property.initializer.getText().slice(1, -1);
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
      return property.initializer.getText();
    default:
      return undefined;
  }
}
