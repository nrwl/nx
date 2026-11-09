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
