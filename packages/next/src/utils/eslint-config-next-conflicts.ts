import type { Tree } from '@nx/devkit';
import {
  getInstalledEslintVersion,
  isEslintConfigFile,
  versions as eslintVersions,
} from '@nx/eslint/internal';
import { ensureTypescript } from '@nx/js/internal';
import { coerce } from 'semver';
import type * as ts from 'typescript';
import {
  getModuleBindings,
  getPropertyName,
  parseFlatConfig,
} from './flat-config-source';

// The plugins eslint-config-next registers. ESLint fails when two configs
// register different copies of one plugin.
const CONFLICTING_PLUGIN_MODULES = new Set([
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-import',
  'eslint-plugin-jsx-a11y',
]);
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
 * also registers. Generated project configs spread the root config, so its
 * plugins load next to theirs.
 */
export function findRootConfigWithConflictingPlugin(
  tree: Tree,
  eslintMajor: number
): string | undefined {
  return tree
    .children('')
    .filter((file) => isEslintConfigFile(file) && tree.isFile(file))
    .find((file) =>
      registersConflictingPlugin(
        parseFlatConfig(tree.read(file, 'utf-8')),
        eslintMajor
      )
    );
}

export function registersConflictingPlugin(
  source: ts.SourceFile,
  eslintMajor: number
): boolean {
  const bindings = getModuleBindings(source);
  if (
    [...bindings.values()].some((module) =>
      CONFLICTING_PLUGIN_MODULES.has(module)
    )
  ) {
    return true;
  }
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
    if (
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
