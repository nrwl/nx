import { formatFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { Printer, PropertyAssignment } from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
  removeObjectProperty,
  updateObjectProperty,
} from '../../utils/migrations';

let printer: Printer;
let ts: typeof import('typescript');

// https://docs.cypress.io/app/references/migration-guide#CT-Just-in-Time-Compile-changes
export default async function (tree: Tree) {
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      // cypress config file doesn't exist, so skip
      continue;
    }

    ts ??= ensureTypescript();
    printer ??= ts.createPrinter();

    const cypressConfig = tree.read(cypressConfigPath, 'utf-8');
    const updatedConfig = updateCtJustInTimeCompile(cypressConfig);

    tree.write(cypressConfigPath, updatedConfig);
  }

  await formatFiles(tree);
}

function updateCtJustInTimeCompile(cypressConfig: string): string {
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  const componentConfig = getObjectProperty(config, 'component');
  if (!componentConfig) {
    // no component config, leave as is
    return cypressConfig;
  }

  const sourceFile = tsquery.ast(cypressConfig);
  let updatedConfig = config;

  const bundlerProperty = tsquery.query<PropertyAssignment>(
    updatedConfig,
    'PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=bundler])'
  )[0];
  const isViteBundler =
    bundlerProperty &&
    ts.isStringLiteral(bundlerProperty.initializer) &&
    bundlerProperty.initializer.getText().replace(/['"`]/g, '') === 'vite';

  const existingJustInTimeCompileProperty = getObjectProperty(
    updatedConfig,
    'experimentalJustInTimeCompile'
  );
  if (existingJustInTimeCompileProperty) {
    if (
      isViteBundler ||
      existingJustInTimeCompileProperty.initializer.kind ===
        ts.SyntaxKind.TrueKeyword
    ) {
      // if it's using vite or it's set to true (the new default value), remove it
      updatedConfig = removeObjectProperty(
        updatedConfig,
        existingJustInTimeCompileProperty
      );
    } else {
      // rename to justInTimeCompile
      updatedConfig = updateObjectProperty(
        updatedConfig,
        existingJustInTimeCompileProperty,
        { newName: 'justInTimeCompile' }
      );
    }
  }

  const componentProperty = getObjectProperty(updatedConfig, 'component');
  if (
    componentProperty &&
    ts.isObjectLiteralExpression(componentProperty.initializer)
  ) {
    const componentConfigObject = componentProperty.initializer;
    const existingJustInTimeCompileProperty = getObjectProperty(
      componentConfigObject,
      'experimentalJustInTimeCompile'
    );
    if (existingJustInTimeCompileProperty) {
      if (
        isViteBundler ||
        existingJustInTimeCompileProperty.initializer.kind ===
          ts.SyntaxKind.TrueKeyword
      ) {
        // if it's using vite or it's set to true (the new default value), remove it
        updatedConfig = updateObjectProperty(updatedConfig, componentProperty, {
          newValue: removeObjectProperty(
            componentConfigObject,
            existingJustInTimeCompileProperty
          ),
        });
      } else {
        // rename to justInTimeCompile
        updatedConfig = updateObjectProperty(updatedConfig, componentProperty, {
          newValue: updateObjectProperty(
            componentConfigObject,
            existingJustInTimeCompileProperty,
            { newName: 'justInTimeCompile' }
          ),
        });
      }
    }
  }

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(ts.EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}
