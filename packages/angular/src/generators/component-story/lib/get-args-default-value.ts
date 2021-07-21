import type { PropertyDeclaration } from 'typescript';

export function getArgsDefaultValue(property: PropertyDeclaration): string {
  const typeNameToDefault = {
    string: "''",
    number: '0',
    boolean: 'false',
  };
  return property.initializer
    ? property.initializer.getText()
    : property.type
    ? typeNameToDefault[property.type.getText()]
    : "''";
}
