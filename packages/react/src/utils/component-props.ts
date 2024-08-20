import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type * as ts from 'typescript';
import { parseComponentPropsInfo } from './ast-utils';

let tsModule: typeof import('typescript');

// TODO: candidate to refactor with the angular component story
export function getArgsDefaultValue(property: ts.SyntaxKind): string {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const typeNameToDefault: Record<number, any> = {
    [tsModule.SyntaxKind.StringKeyword]: "''",
    [tsModule.SyntaxKind.NumberKeyword]: 0,
    [tsModule.SyntaxKind.BooleanKeyword]: false,
  };

  const resolvedValue = typeNameToDefault[property];
  if (resolvedValue === undefined) {
    return "''";
  } else {
    return resolvedValue;
  }
}

export function getComponentPropDefaults(
  sourceFile: ts.SourceFile,
  cmpDeclaration: ts.Node
): {
  propsTypeName: string | null;
  inlineTypeString: string | null;
  props: {
    name: string;
    defaultValue: any;
  }[];
  argTypes: {
    name: string;
    type: string;
    actionText: string;
  }[];
} {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const info = parseComponentPropsInfo(sourceFile, cmpDeclaration);

  let propsTypeName: string = null;
  let inlineTypeString: string = null;
  let props: {
    name: string;
    defaultValue: any;
  }[] = [];
  let argTypes: {
    name: string;
    type: string;
    actionText: string;
  }[] = [];

  if (info) {
    propsTypeName = info.propsTypeName;
    inlineTypeString = info.inlineTypeString;
    props = info.props.map((member) => {
      if (tsModule.isPropertySignature(member)) {
        if (member.type.kind === tsModule.SyntaxKind.FunctionType) {
          argTypes.push({
            name: member.name.getText(),
            type: 'action',
            actionText: `${member.name.getText()} executed!`,
          });
        } else {
          return {
            name: member.name.getText(),
            defaultValue: getArgsDefaultValue(member.type.kind),
          };
        }
      } else {
        // it's a binding element, which doesn't have a type, e.g.:
        // const Cmp = ({ a, b }) => {}
        return {
          name: member.name.getText(),
          defaultValue: getArgsDefaultValue(member.kind),
        };
      }
    });
    props = props.filter((p) => p && p.defaultValue !== undefined);
  }
  return { propsTypeName, inlineTypeString, props, argTypes };
}

export function getImportForType(sourceFile: ts.SourceFile, typeName: string) {
  return sourceFile.statements.find(
    (statement: ts.Node) =>
      tsModule.isImportDeclaration(statement) &&
      statement.getText().includes(typeName)
  );
}
