import {
  getProjects,
  globAsync,
  readNxJson,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  interpolate,
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';
import { ensureTypescript } from '@nx/js/internal';
import { posix } from 'path';
import type {
  Expression,
  ModuleDeclaration,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertyName,
  SourceFile,
  StringLiteralLike,
} from 'typescript';
import type { CypressExecutorOptions } from '../executors/cypress/cypress.impl';
import { CYPRESS_CONFIG_FILE_NAME_PATTERN } from './config';

let ts: typeof import('typescript');

export async function* cypressProjectConfigs(tree: Tree): AsyncGenerator<{
  projectName: string;
  projectConfig: ProjectConfiguration;
  cypressConfigPath: string;
}> {
  const projects = getProjects(tree);
  const targetDefaults = readNxJson(tree)?.targetDefaults;

  for (const [projectName, projectConfig] of projects) {
    const cypressConfigPaths = new Set<string>();
    for (const [targetName, target] of Object.entries(
      projectConfig.targets ?? {}
    )) {
      if (target.command) {
        continue;
      }
      const merged = mergeTargetConfigurations(
        target,
        readTargetDefaultsForTarget(
          targetName,
          targetDefaults,
          target.executor,
          {
            projectName,
            projectNode: {
              name: projectName,
              type: projectConfig.projectType === 'application' ? 'app' : 'lib',
              data: projectConfig,
            },
          }
        ) ?? undefined
      );
      if (merged.executor !== '@nx/cypress:cypress') {
        continue;
      }
      for (const [, options] of allTargetOptions<CypressExecutorOptions>(
        merged
      )) {
        if (options.cypressConfig) {
          cypressConfigPaths.add(
            posix.normalize(
              interpolate(options.cypressConfig, {
                workspaceRoot: '.',
                projectRoot: projectConfig.root,
                projectName,
              })
            )
          );
        }
      }
    }
    if (cypressConfigPaths.size === 0) {
      const result = await globAsync(tree, [
        posix.join(projectConfig.root, CYPRESS_CONFIG_FILE_NAME_PATTERN),
      ]);
      if (result.length > 0) {
        cypressConfigPaths.add(result[0]);
      }
    }
    for (const cypressConfigPath of cypressConfigPaths) {
      yield { projectName, projectConfig, cypressConfigPath };
    }
  }
}

export function getObjectProperty(
  config: ObjectLiteralExpression,
  name: string
): PropertyAssignment | undefined {
  ts ??= ensureTypescript();

  return config.properties.find(
    (p): p is PropertyAssignment =>
      ts.isPropertyAssignment(p) && p.name.getText() === name
  );
}

export function removeObjectProperty(
  config: ObjectLiteralExpression,
  property: PropertyAssignment
): ObjectLiteralExpression {
  ts ??= ensureTypescript();

  return ts.factory.updateObjectLiteralExpression(
    config,
    config.properties.filter((p) => p !== property)
  );
}

export function updateObjectProperty(
  config: ObjectLiteralExpression,
  property: PropertyAssignment,
  { newName, newValue }: { newName?: string; newValue?: Expression }
): ObjectLiteralExpression {
  ts ??= ensureTypescript();

  if (!newName && !newValue) {
    throw new Error('newName or newValue must be provided');
  }

  return ts.factory.updateObjectLiteralExpression(
    config,
    config.properties.map((p) =>
      p === property
        ? ts.factory.updatePropertyAssignment(
            p,
            newName ? ts.factory.createIdentifier(newName) : p.name,
            newValue ? newValue : p.initializer
          )
        : p
    )
  );
}

// Resolves the module specifier that binds the `nxComponentTestingPreset`
// identifier in a cypress config, covering both ESM `import` and CJS
// `require` forms. Returns null when no such binding is found.
export function getComponentTestingPresetImport(
  sourceFile: SourceFile
): string | null {
  ts ??= ensureTypescript();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const namedBindings = statement.importClause.namedBindings;
      if (
        namedBindings &&
        ts.isNamedImports(namedBindings) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        namedBindings.elements.some(
          (element) => element.name.text === 'nxComponentTestingPreset'
        )
      ) {
        return statement.moduleSpecifier.text;
      }
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (
          !initializer ||
          !ts.isCallExpression(initializer) ||
          !ts.isIdentifier(initializer.expression) ||
          initializer.expression.text !== 'require' ||
          !ts.isObjectBindingPattern(declaration.name)
        ) {
          continue;
        }
        const moduleSpecifier = initializer.arguments[0];
        if (
          moduleSpecifier &&
          ts.isStringLiteral(moduleSpecifier) &&
          declaration.name.elements.some(
            (element) =>
              ts.isIdentifier(element.name) &&
              element.name.text === 'nxComponentTestingPreset'
          )
        ) {
          return moduleSpecifier.text;
        }
      }
    }
  }

  return null;
}

// Returns null for a computed name that is not a string literal.
export function getPropertyName(name: PropertyName): string | null {
  ts ??= ensureTypescript();

  if (ts.isIdentifier(name) || isStringLiteralName(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name) && isStringLiteralName(name.expression)) {
    return name.expression.text;
  }
  return null;
}

function isStringLiteralName(node: Node): node is StringLiteralLike {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function* allTargetOptions<T>(
  target: TargetConfiguration<T>
): Iterable<[string | undefined, T]> {
  if (target.options) {
    yield [undefined, target.options];
  }

  if (!target.configurations) {
    return;
  }

  for (const [name, options] of Object.entries(target.configurations)) {
    if (options !== undefined) {
      yield [name, options];
    }
  }
}

// The extension picks the script kind, so `<T>x` in a .ts file and JSX in a
// .tsx file both parse; tsquery's `ast()` parses everything as TSX.
export function parseSourceFile(filePath: string, content: string): SourceFile {
  ts ??= ensureTypescript();

  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true
  );
}

/**
 * Whether the file binds `name` as a runtime value anywhere: a variable,
 * parameter, destructured element, function or class (declaration or named
 * expression), enum, namespace holding a value, or a value import (`import x`,
 * `import { x }`, `import * as x`, `import x =`).
 * Type-only imports and ambient declarations (`declare ...`, including
 * everything under `declare global`) do not count, so the usual
 * `declare global { namespace Cypress { ... } }` augmentation never hides the
 * `Cypress` global.
 */
export function hasLocalValueBinding(
  sourceFile: SourceFile,
  name: string
): boolean {
  ts ??= ensureTypescript();
  if (sourceFile.isDeclarationFile) {
    return false;
  }

  const bindsName = (node: Node): boolean => {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isEnumDeclaration(node)
    ) {
      return (
        !!node.name && ts.isIdentifier(node.name) && node.name.text === name
      );
    }
    if (ts.isModuleDeclaration(node)) {
      return (
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        isInstantiatedNamespace(node)
      );
    }
    if (ts.isImportClause(node)) {
      return !node.isTypeOnly && node.name?.text === name;
    }
    if (ts.isImportSpecifier(node)) {
      return (
        !node.isTypeOnly &&
        !node.parent.parent.isTypeOnly &&
        node.name.text === name
      );
    }
    if (ts.isNamespaceImport(node)) {
      return !node.parent.isTypeOnly && node.name.text === name;
    }
    if (ts.isImportEqualsDeclaration(node)) {
      return !node.isTypeOnly && node.name.text === name;
    }
    return false;
  };

  const visit = (node: Node): boolean => {
    if (
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
    ) {
      return false;
    }
    return bindsName(node) || (ts.forEachChild(node, visit) ?? false);
  };

  return visit(sourceFile);
}

// Mirrors TypeScript's getModuleInstanceState: a namespace emits a value
// unless every statement is a type declaration, a non-exported import or
// such a namespace. Anything else, an expression statement included, and
// `export { x }` lists and const enums, count as a value.
function isInstantiatedNamespace(node: ModuleDeclaration): boolean {
  const body = node.body;
  if (!body) {
    return false;
  }
  if (ts.isModuleDeclaration(body)) {
    return isInstantiatedNamespace(body);
  }
  if (!ts.isModuleBlock(body)) {
    return false;
  }
  return body.statements.some((statement) => {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      return false;
    }
    if (
      ts.isImportDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement)
    ) {
      return !!ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    }
    if (ts.isModuleDeclaration(statement)) {
      return isInstantiatedNamespace(statement);
    }
    return true;
  });
}
