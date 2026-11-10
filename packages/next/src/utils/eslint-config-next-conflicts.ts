import { joinPathFragments, type Tree } from '@nx/devkit';
import {
  getInstalledEslintVersion,
  isEslintConfigFile,
  versions as eslintVersions,
} from '@nx/eslint/internal';
import { ensureTypescript } from '@nx/js/internal';
import { dirname } from 'path';
import { coerce } from 'semver';
import type * as ts from 'typescript';
import { getPropertyName, parseFlatConfig } from './flat-config-source';

// The plugins eslint-config-next registers. ESLint fails when two configs
// register different copies of one plugin.
const CONFLICTING_PLUGIN_MODULES = [
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-import',
  'eslint-plugin-jsx-a11y',
];
const CONFLICTING_PLUGIN_NAMES = new Set([
  'react',
  'react-hooks',
  'import',
  'jsx-a11y',
]);
// `flat/react-base` registers `import` below ESLint v10 and `import-x` from v10 on.
const CONFLICTING_CONFIG_REFERENCE_BELOW_ESLINT_10 =
  /^(?:flat\/react(?:-base|-jsx)?|plugin:(?:react|react-hooks|import|jsx-a11y)\/.+)$/;
const CONFLICTING_CONFIG_REFERENCE =
  /^(?:flat\/react(?:-jsx)?|plugin:(?:react|react-hooks|import|jsx-a11y)\/.+)$/;

let tsModule: typeof import('typescript');

// Without a declared ESLint, the version the linting generators would install.
export function getEslintMajorVersion(tree: Tree): number {
  const version =
    getInstalledEslintVersion(tree) ?? eslintVersions(tree).eslintVersion;
  return coerce(version)?.major ?? 10;
}

/**
 * Returns the first root ESLint config that registers a plugin eslint-config-next
 * also registers, directly or through a local module it imports. Generated
 * project configs spread the root config, so its plugins load next to theirs.
 */
export function findRootConfigWithConflictingPlugin(
  tree: Tree,
  eslintMajor: number
): string | undefined {
  return tree
    .children('')
    .filter((file) => isEslintConfigFile(file) && tree.isFile(file))
    .find(
      (file) =>
        findConfigWithConflictingPlugin(tree, file, eslintMajor) !== undefined
    );
}

/**
 * Returns `configPath`, or the first local module reachable through its imports,
 * that registers a plugin eslint-config-next also registers. Only a relative
 * specifier that names an existing file is followed, so a module loaded without
 * its extension, through a directory or from an npm config package is not found.
 */
export function findConfigWithConflictingPlugin(
  tree: Tree,
  configPath: string,
  eslintMajor: number
): string | undefined {
  const visited = new Set<string>();
  const find = (file: string): string | undefined => {
    if (visited.has(file)) {
      return undefined;
    }
    visited.add(file);
    const source = parseFlatConfig(tree.read(file, 'utf-8'));
    if (registersConflictingPlugin(source, eslintMajor)) {
      return file;
    }
    for (const specifier of getLocalModuleSpecifiers(source)) {
      const imported = resolveLocalModule(tree, file, specifier);
      const found = imported && find(imported);
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  return find(configPath);
}

function getLocalModuleSpecifiers(source: ts.SourceFile): string[] {
  tsModule ??= ensureTypescript();
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    const specifier = getLoadedModuleSpecifier(node);
    if (specifier !== undefined && /^\.\.?\//.test(specifier)) {
      specifiers.push(specifier);
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

// The specifier of an import, re-export, `require`, `import x = require()` or
// `import()` that loads a module at runtime. Type-only imports and exports are
// erased before it runs.
function getLoadedModuleSpecifier(node: ts.Node): string | undefined {
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

// Matches subpaths too: `eslint-plugin-react/configs/recommended.js` registers `react`.
function isConflictingPluginModule(specifier: string): boolean {
  return CONFLICTING_PLUGIN_MODULES.some(
    (module) => specifier === module || specifier.startsWith(`${module}/`)
  );
}

function resolveLocalModule(
  tree: Tree,
  importer: string,
  specifier: string
): string | undefined {
  const path = joinPathFragments(dirname(importer), specifier);
  return !isOutsideWorkspace(path) && tree.isFile(path) ? path : undefined;
}

function isOutsideWorkspace(path: string): boolean {
  return path === '..' || path.startsWith('../');
}

// Any load of one of the plugins counts, so a plugin registered under a
// computed key is found when its object comes from one of those packages.
function registersConflictingPlugin(
  source: ts.SourceFile,
  eslintMajor: number
): boolean {
  const configReference =
    eslintMajor < 10
      ? CONFLICTING_CONFIG_REFERENCE_BELOW_ESLINT_10
      : CONFLICTING_CONFIG_REFERENCE;
  tsModule ??= ensureTypescript();
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }
    const specifier = getLoadedModuleSpecifier(node);
    if (
      (specifier !== undefined && isConflictingPluginModule(specifier)) ||
      (tsModule.isStringLiteralLike(node) && configReference.test(node.text)) ||
      (tsModule.isPropertyAssignment(node) &&
        getPropertyName(node.name) === 'plugins' &&
        tsModule.isObjectLiteralExpression(node.initializer) &&
        node.initializer.properties.some(
          (property) =>
            property.name &&
            CONFLICTING_PLUGIN_NAMES.has(getPropertyName(property.name))
        ))
    ) {
      found = true;
      return;
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
