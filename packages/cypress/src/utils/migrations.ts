import {
  getProjects,
  globAsync,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { posix } from 'path';
import type {
  Expression,
  ModuleDeclaration,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'typescript';
import type { CypressExecutorOptions } from '../executors/cypress/schema';
import { CYPRESS_CONFIG_FILE_NAME_PATTERN } from './config';

let ts: typeof import('typescript');

export async function* cypressProjectConfigs(tree: Tree): AsyncGenerator<{
  projectName: string;
  projectConfig: ProjectConfiguration;
  cypressConfigPath: string;
}> {
  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    const targetsWithExecutor = Object.values(
      projectConfig.targets ?? {}
    ).filter((target) => target.executor === '@nx/cypress:cypress');
    if (targetsWithExecutor.length > 0) {
      const cypressConfigPaths = new Set<string>();
      for (const target of targetsWithExecutor) {
        for (const [, options] of allTargetOptions<CypressExecutorOptions>(
          target
        )) {
          if (options.cypressConfig) {
            cypressConfigPaths.add(options.cypressConfig);
          }
        }
      }
      for (const cypressConfigPath of cypressConfigPaths) {
        yield { projectName, projectConfig, cypressConfigPath };
      }
    } else {
      // might be using the crystal plugin
      const result = await globAsync(tree, [
        posix.join(projectConfig.root, CYPRESS_CONFIG_FILE_NAME_PATTERN),
      ]);
      if (result.length > 0) {
        yield {
          projectName,
          projectConfig,
          cypressConfigPath: result[0],
        };
      }
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
