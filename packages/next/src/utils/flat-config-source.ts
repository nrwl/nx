import { ensureTypescript } from '@nx/js/internal';
import type * as ts from 'typescript';

// Loaded by parseFlatConfig. The other helpers only take nodes it produced.
let tsModule: typeof import('typescript');

export function parseFlatConfig(content: string): ts.SourceFile {
  tsModule ??= ensureTypescript();
  return tsModule.createSourceFile(
    '',
    content,
    tsModule.ScriptTarget.Latest,
    true,
    tsModule.ScriptKind.TS
  );
}

export function getModuleBindings(source: ts.SourceFile): Map<string, string> {
  const bindings = new Map<string, string>();
  for (const statement of source.statements) {
    for (const { module, names } of getImports(statement)) {
      names.forEach((name) => bindings.set(name, module));
    }
  }
  return bindings;
}

export function getImports(
  statement: ts.Statement
): { module: string; names: string[] }[] {
  if (tsModule.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause || !tsModule.isStringLiteral(statement.moduleSpecifier)) {
      return [];
    }
    const names = clause.name ? [clause.name.text] : [];
    if (clause.namedBindings) {
      if (tsModule.isNamespaceImport(clause.namedBindings)) {
        names.push(clause.namedBindings.name.text);
      } else {
        names.push(
          ...clause.namedBindings.elements.map((element) => element.name.text)
        );
      }
    }
    return [{ module: statement.moduleSpecifier.text, names }];
  }
  if (
    tsModule.isVariableStatement(statement) &&
    statement.declarationList.declarations.length === 1
  ) {
    const [declaration] = statement.declarationList.declarations;
    const initializer = declaration.initializer;
    if (
      !initializer ||
      !tsModule.isCallExpression(initializer) ||
      !tsModule.isIdentifier(initializer.expression) ||
      initializer.expression.text !== 'require' ||
      initializer.arguments.length !== 1 ||
      !tsModule.isStringLiteral(initializer.arguments[0])
    ) {
      return [];
    }
    return [
      {
        module: initializer.arguments[0].text,
        names: getBoundNames(declaration.name),
      },
    ];
  }
  return [];
}

function getBoundNames(name: ts.BindingName): string[] {
  if (tsModule.isIdentifier(name)) {
    return [name.text];
  }
  const names: string[] = [];
  for (const element of name.elements) {
    if (!tsModule.isOmittedExpression(element)) {
      names.push(...getBoundNames(element.name));
    }
  }
  return names;
}

export function getPropertyName(name: ts.PropertyName): string | undefined {
  return tsModule.isIdentifier(name) ||
    tsModule.isStringLiteral(name) ||
    tsModule.isNoSubstitutionTemplateLiteral(name)
    ? name.text
    : undefined;
}

// The specifier of an import, re-export, `require`, `import x = require()` or
// `import()` that loads a module at runtime. Type-only imports and exports are
// erased before it runs.
export function getLoadedModuleSpecifier(node: ts.Node): string | undefined {
  let specifier: ts.Expression | undefined;
  if (tsModule.isImportDeclaration(node)) {
    specifier = node.importClause?.isTypeOnly
      ? undefined
      : node.moduleSpecifier;
  } else if (tsModule.isExportDeclaration(node)) {
    specifier = node.isTypeOnly ? undefined : node.moduleSpecifier;
  } else if (
    tsModule.isImportEqualsDeclaration(node) &&
    tsModule.isExternalModuleReference(node.moduleReference)
  ) {
    specifier = node.isTypeOnly ? undefined : node.moduleReference.expression;
  } else if (
    tsModule.isCallExpression(node) &&
    node.arguments.length === 1 &&
    ((tsModule.isIdentifier(node.expression) &&
      node.expression.text === 'require') ||
      node.expression.kind === tsModule.SyntaxKind.ImportKeyword)
  ) {
    specifier = node.arguments[0];
  }
  return specifier && tsModule.isStringLiteralLike(specifier)
    ? specifier.text
    : undefined;
}

export interface EslintConfigNextUsage {
  /** Loads `eslint-config-next` or one of its flat configs. */
  importsEslintConfigNext: boolean;
  /** Registers the `@next/next` plugin, as Nx generated for Next.js 16 apps. */
  registersNextPlugin: boolean;
  /** Extends `next` or a `next/*` config through FlatCompat, as Nx generated for earlier Next.js versions. */
  extendsNextThroughCompat: boolean;
}

export function getEslintConfigNextUsage(
  source: ts.SourceFile
): EslintConfigNextUsage {
  const usage: EslintConfigNextUsage = {
    importsEslintConfigNext: false,
    registersNextPlugin: false,
    extendsNextThroughCompat: false,
  };
  const visit = (node: ts.Node) => {
    if (isEslintConfigNextSpecifier(getLoadedModuleSpecifier(node))) {
      usage.importsEslintConfigNext = true;
    } else if (isPluginsObjectWithKey(node, '@next/next')) {
      usage.registersNextPlugin = true;
    } else if (isCompatCallExtendingNext(node)) {
      usage.extendsNextThroughCompat = true;
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return usage;
}

// eslint-config-next entries without Next.js rules, with v15's file spellings.
const ESLINT_CONFIG_NEXT_ENTRIES_WITHOUT_NEXT_RULES = new Set([
  'eslint-config-next/typescript',
  'eslint-config-next/typescript.js',
  'eslint-config-next/parser',
  'eslint-config-next/parser.js',
]);

/**
 * Whether a flat config sets up Next.js linting in any form: a load of an
 * eslint-config-next entry with Next.js rules or of `@next/eslint-plugin-next`,
 * a `@next/next` plugin registration, a FlatCompat extend of such a `next`
 * config, or a string starting with `@next/next/`, such as a rule name.
 */
export function configuresNextLint(source: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }
    const specifier = getLoadedModuleSpecifier(node);
    if (
      (isEslintConfigNextSpecifier(specifier) &&
        !ESLINT_CONFIG_NEXT_ENTRIES_WITHOUT_NEXT_RULES.has(specifier)) ||
      specifier === '@next/eslint-plugin-next' ||
      specifier?.startsWith('@next/eslint-plugin-next/') ||
      isPluginsObjectWithKey(node, '@next/next') ||
      isCompatCallExtendingNext(node, isNextConfigNameWithNextRules) ||
      (tsModule.isStringLiteralLike(node) &&
        node.text.startsWith('@next/next/'))
    ) {
      found = true;
      return;
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function isPluginsObjectWithKey(node: ts.Node, key: string): boolean {
  return (
    tsModule.isPropertyAssignment(node) &&
    getPropertyName(node.name) === 'plugins' &&
    tsModule.isObjectLiteralExpression(node.initializer) &&
    node.initializer.properties.some(
      (property) => property.name && getPropertyName(property.name) === key
    )
  );
}

// Matches `compat.extends('next', ...)` and `compat.config({ extends: ['next'] })`.
function isCompatCallExtendingNext(
  node: ts.Node,
  isConfigName: (node: ts.Node) => boolean = isNextConfigName
): boolean {
  if (
    !tsModule.isCallExpression(node) ||
    !tsModule.isPropertyAccessExpression(node.expression)
  ) {
    return false;
  }
  switch (node.expression.name.text) {
    case 'extends':
      return node.arguments.some(isConfigName);
    case 'config':
      return node.arguments.some(
        (argument) =>
          tsModule.isObjectLiteralExpression(argument) &&
          argument.properties.some(
            (property) =>
              tsModule.isPropertyAssignment(property) &&
              getPropertyName(property.name) === 'extends' &&
              (isConfigName(property.initializer) ||
                (tsModule.isArrayLiteralExpression(property.initializer) &&
                  property.initializer.elements.some(isConfigName)))
          )
      );
    default:
      return false;
  }
}

function isEslintConfigNextSpecifier(
  specifier: string | undefined
): specifier is string {
  return (
    specifier === 'eslint-config-next' ||
    !!specifier?.startsWith('eslint-config-next/')
  );
}

function isNextConfigName(node: ts.Node): node is ts.StringLiteralLike {
  return (
    tsModule.isStringLiteralLike(node) &&
    (node.text === 'next' || node.text.startsWith('next/'))
  );
}

// ESLint resolves an eslintrc `next/<name>` to `eslint-config-next/<name>`.
function isNextConfigNameWithNextRules(node: ts.Node): boolean {
  return (
    isNextConfigName(node) &&
    !ESLINT_CONFIG_NEXT_ENTRIES_WITHOUT_NEXT_RULES.has(
      node.text.replace(/^next\//, 'eslint-config-next/')
    )
  );
}
