import * as ts from 'typescript';
import { getComponentPropsInterface } from './ast-utils';

// TODO: candidate to refactor with the angular component story
export function getArgsDefaultValue(property: ts.SyntaxKind): string {
  const typeNameToDefault: Record<number, any> = {
    [ts.SyntaxKind.StringKeyword]: "''",
    [ts.SyntaxKind.NumberKeyword]: 0,
    [ts.SyntaxKind.BooleanKeyword]: false,
  };

  const resolvedValue = typeNameToDefault[property];
  if (typeof resolvedValue === undefined) {
    return "''";
  } else {
    return resolvedValue;
  }
}

export function getDefaultsForComponent(
  sourceFile: ts.SourceFile,
  cmpDeclaration: ts.Node
) {
  const propsInterface = getComponentPropsInterface(sourceFile, cmpDeclaration);

  let propsTypeName: string = null;
  let props: {
    name: string;
    defaultValue: any;
  }[] = [];
  let argTypes: {
    name: string;
    type: string;
    actionText: string;
  }[] = [];

  if (propsInterface) {
    propsTypeName = propsInterface.name.text;
    props = propsInterface.members.map((member: ts.PropertySignature) => {
      if (member.type.kind === ts.SyntaxKind.FunctionType) {
        argTypes.push({
          name: (member.name as ts.Identifier).text,
          type: 'action',
          actionText: `${(member.name as ts.Identifier).text} executed!`,
        });
      } else {
        return {
          name: (member.name as ts.Identifier).text,
          defaultValue: getArgsDefaultValue(member.type.kind),
        };
      }
    });
    props = props.filter((p) => p && p.defaultValue !== undefined);
  }
  return { propsTypeName, props, argTypes };
}

export function getImportForType(sourceFile: ts.SourceFile, typeName: string) {
  return sourceFile.statements.find(
    (statement: ts.Node) =>
      ts.isImportDeclaration(statement) &&
      statement.getText().includes(typeName)
  );
}
