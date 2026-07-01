import { formatFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { query } from '@phenomnomnominal/tsquery';
import type { CallExpression, PropertyAssignment } from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
} from '../../utils/migrations';

const JIT_COMMENT = [
  '// Cypress 14+ defaults justInTimeCompile to true (webpack only), which can',
  '// intermittently run 0 tests in CI. Remove this line to opt back in.',
];

const NX_WEBPACK_CT_PRESETS = [
  '@nx/angular/plugins/component-testing',
  '@nx/react/plugins/component-testing',
  '@nx/next/plugins/component-testing',
];
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
      !isWebpackComponentTesting(contents, component) ||
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

function isWebpackComponentTesting(
  contents: string,
  component: PropertyAssignment
): boolean {
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
    // @nx/remix is the only vite-based Nx CT preset.
    return getNxCtPreset(contents) !== NX_VITE_CT_PRESET;
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

function getNxCtPreset(contents: string): string | null {
  if (contents.includes(NX_VITE_CT_PRESET)) {
    return NX_VITE_CT_PRESET;
  }
  return (
    NX_WEBPACK_CT_PRESETS.find((preset) => contents.includes(preset)) ?? null
  );
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
  const comment = JIT_COMMENT.map((line) => `${indent}${line}`).join('\n');
  const newProperty = `${comment}\n${indent}justInTimeCompile: false,`;
  const initializer = component.initializer;

  let componentValue: string;
  if (ts.isObjectLiteralExpression(initializer)) {
    if (initializer.properties.length === 0) {
      componentValue = `{\n${newProperty}\n  }`;
    } else {
      // Preserve the existing object text (including comments) and insert the
      // new property before the closing brace.
      const objectText = contents.slice(
        initializer.getStart(),
        initializer.getEnd()
      );
      const beforeClose = objectText.replace(/\s*}$/, '');
      const separator = /,\s*$/.test(beforeClose) ? '' : ',';
      componentValue = `${beforeClose}${separator}\n${newProperty}\n  }`;
    }
  } else {
    componentValue = `{\n${indent}...${initializer.getText()},\n${newProperty}\n  }`;
  }

  return `${contents.slice(
    0,
    component.getStart()
  )}component: ${componentValue}${contents.slice(component.getEnd())}`;
}
