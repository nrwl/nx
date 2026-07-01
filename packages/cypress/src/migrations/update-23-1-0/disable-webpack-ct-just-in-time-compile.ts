import { formatFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { query } from '@phenomnomnominal/tsquery';
import type { CallExpression, PropertyAssignment } from 'typescript';
import {
  JIT_COMPILE_DISABLE_COMMENT,
  resolveCypressConfigObject,
} from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
} from '../../utils/migrations';

// @nx/remix component testing uses the vite dev server, so justInTimeCompile
// (webpack only) does not apply even though the preset takes no bundler option.
const NX_VITE_CT_PRESET = '@nx/remix/plugins/component-testing';

let ts: typeof import('typescript');

export default async function disableWebpackCtJustInTimeCompile(tree: Tree) {
  let wereProjectsMigrated = false;
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      continue;
    }

    const contents = tree.read(cypressConfigPath, 'utf-8');
    const config = resolveCypressConfigObject(contents);
    if (!config) {
      continue;
    }

    const component = getObjectProperty(config, 'component');
    if (
      !component ||
      !isWebpackComponentTesting(component) ||
      setsJustInTimeCompile(component)
    ) {
      continue;
    }

    tree.write(cypressConfigPath, addJustInTimeCompile(contents, component));
    wereProjectsMigrated = true;
  }

  if (wereProjectsMigrated) {
    await formatFiles(tree);
  }
}

function isWebpackComponentTesting(component: PropertyAssignment): boolean {
  ts ??= ensureTypescript();

  // A vite bundler (inline devServer or preset options) opts out.
  if (
    getComponentProperty(component, 'bundler').some(
      (property) =>
        ts.isStringLiteral(property.initializer) &&
        property.initializer.text === 'vite'
    )
  ) {
    return false;
  }

  // Preset-based config: trust it only when `component` actually calls
  // nxComponentTestingPreset, so a stale/unused preset import doesn't count.
  if (usesNxComponentTestingPreset(component)) {
    // @nx/remix is the only vite-based Nx CT preset; resolve the import bound
    // to the call so an unrelated remix reference elsewhere can't misclassify.
    return getComponentTestingPresetImport(component) !== NX_VITE_CT_PRESET;
  }

  // Hand-written config: migrate only when it has an inline devServer framework.
  return hasInlineDevServerFramework(component);
}

function usesNxComponentTestingPreset(component: PropertyAssignment): boolean {
  ts ??= ensureTypescript();

  return query<CallExpression>(component, 'CallExpression').some(
    (call) =>
      ts.isIdentifier(call.expression) &&
      call.expression.text === 'nxComponentTestingPreset'
  );
}

function hasInlineDevServerFramework(component: PropertyAssignment): boolean {
  ts ??= ensureTypescript();

  if (!ts.isObjectLiteralExpression(component.initializer)) {
    return false;
  }
  const devServer = getObjectProperty(component.initializer, 'devServer');
  if (!devServer || !ts.isObjectLiteralExpression(devServer.initializer)) {
    return false;
  }

  return !!getObjectProperty(devServer.initializer, 'framework');
}

function getComponentProperty(
  component: PropertyAssignment,
  name: string
): PropertyAssignment[] {
  ts ??= ensureTypescript();

  return query<PropertyAssignment>(component, 'PropertyAssignment').filter(
    (property) => ts.isIdentifier(property.name) && property.name.text === name
  );
}

// Resolves the module specifier that binds the `nxComponentTestingPreset`
// identifier used inside `component`, covering both ESM `import` and CJS
// `require` cypress configs. Returns null when no such binding is found.
function getComponentTestingPresetImport(
  component: PropertyAssignment
): string | null {
  ts ??= ensureTypescript();

  for (const statement of component.getSourceFile().statements) {
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

function setsJustInTimeCompile(component: PropertyAssignment): boolean {
  return getComponentProperty(component, 'justInTimeCompile').length > 0;
}

function addJustInTimeCompile(
  contents: string,
  component: PropertyAssignment
): string {
  ts ??= ensureTypescript();

  const indent = '    ';
  const comment = JIT_COMPILE_DISABLE_COMMENT.map(
    (line) => `${indent}${line}`
  ).join('\n');
  const newProperty = `${comment}\n${indent}justInTimeCompile: false,`;
  const initializer = component.initializer;

  // Object literal: insert the property after the last existing one, leaving
  // the surrounding source (comments, formatting) untouched. `component` is
  // gated to be non-empty before we reach here.
  if (ts.isObjectLiteralExpression(initializer)) {
    const properties = initializer.properties;
    const lastProperty = properties[properties.length - 1];
    let insertAt = lastProperty.getEnd();
    if (properties.hasTrailingComma) {
      // Insert after the existing trailing comma, not before it.
      const commaIndex = contents.indexOf(',', insertAt);
      if (commaIndex !== -1) {
        insertAt = commaIndex + 1;
      }
    }
    const separator = properties.hasTrailingComma ? '' : ',';
    return `${contents.slice(
      0,
      insertAt
    )}${separator}\n${newProperty}${contents.slice(insertAt)}`;
  }

  // Preset call (or any other expression): wrap it in an object and spread.
  const componentValue = `{\n${indent}...${initializer.getText()},\n${newProperty}\n  }`;
  return `${contents.slice(
    0,
    component.getStart()
  )}component: ${componentValue}${contents.slice(component.getEnd())}`;
}
