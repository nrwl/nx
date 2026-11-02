import * as ts from 'typescript';

export interface EslintConfigNextUsage {
  /** Imports `eslint-config-next` or one of its flat configs. */
  importsEslintConfigNext: boolean;
  /** Registers the `@next/next` plugin, as Nx generated for Next.js 16 apps. */
  registersNextPlugin: boolean;
  /** Extends `next` or a `next/*` config through FlatCompat, as Nx generated for earlier Next.js versions. */
  extendsNextThroughCompat: boolean;
}

export function getEslintConfigNextUsage(
  content: string
): EslintConfigNextUsage {
  const usage: EslintConfigNextUsage = {
    importsEslintConfigNext: false,
    registersNextPlugin: false,
    extendsNextThroughCompat: false,
  };
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const visit = (node: ts.Node) => {
    const specifier = getModuleSpecifier(node);
    if (
      specifier === 'eslint-config-next' ||
      specifier?.startsWith('eslint-config-next/')
    ) {
      usage.importsEslintConfigNext = true;
    } else if (isPluginsObjectWithKey(node, '@next/next')) {
      usage.registersNextPlugin = true;
    } else if (isCompatCallExtendingNext(node)) {
      usage.extendsNextThroughCompat = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return usage;
}

function getModuleSpecifier(node: ts.Node): string | undefined {
  if (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  return undefined;
}

function isPluginsObjectWithKey(node: ts.Node, key: string): boolean {
  return (
    ts.isPropertyAssignment(node) &&
    getPropertyName(node.name) === 'plugins' &&
    ts.isObjectLiteralExpression(node.initializer) &&
    node.initializer.properties.some(
      (property) => property.name && getPropertyName(property.name) === key
    )
  );
}

// Matches `compat.extends('next', ...)` and `compat.config({ extends: ['next'] })`.
function isCompatCallExtendingNext(node: ts.Node): boolean {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression)
  ) {
    return false;
  }
  switch (node.expression.name.text) {
    case 'extends':
      return node.arguments.some(isNextConfigName);
    case 'config':
      return node.arguments.some(
        (argument) =>
          ts.isObjectLiteralExpression(argument) &&
          argument.properties.some(
            (property) =>
              ts.isPropertyAssignment(property) &&
              getPropertyName(property.name) === 'extends' &&
              (isNextConfigName(property.initializer) ||
                (ts.isArrayLiteralExpression(property.initializer) &&
                  property.initializer.elements.some(isNextConfigName)))
          )
      );
    default:
      return false;
  }
}

function isNextConfigName(node: ts.Node): boolean {
  return (
    ts.isStringLiteralLike(node) &&
    (node.text === 'next' || node.text.startsWith('next/'))
  );
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}
