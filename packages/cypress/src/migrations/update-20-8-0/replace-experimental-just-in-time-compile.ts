import { formatFiles, workspaceRoot, type Tree } from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { join } from 'node:path';
import type {
  ObjectLiteralExpression,
  Printer,
  PropertyAssignment,
} from 'typescript';
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

    const updatedConfig = await updateCtJustInTimeCompile(
      tree,
      cypressConfigPath
    );

    tree.write(cypressConfigPath, updatedConfig);
  }

  await formatFiles(tree);
}

async function updateCtJustInTimeCompile(
  tree: Tree,
  cypressConfigPath: string
): Promise<string> {
  const cypressConfig = tree.read(cypressConfigPath, 'utf-8');
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  if (!getObjectProperty(config, 'component')) {
    // no component config, leave as is
    return cypressConfig;
  }

  ts ??= ensureTypescript();
  printer ??= ts.createPrinter();

  const sourceFile = tsquery.ast(cypressConfig);
  let updatedConfig = config;

  const bundler = await resolveBundler(updatedConfig, cypressConfigPath);
  const isViteBundler = bundler === 'vite';

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

async function resolveBundler(
  config: ObjectLiteralExpression,
  cypressConfigPath: string
): Promise<string | null> {
  const bundlerProperty = tsquery.query<PropertyAssignment>(
    config,
    'PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=bundler])'
  )[0];

  if (bundlerProperty) {
    return ts.isStringLiteral(bundlerProperty.initializer)
      ? bundlerProperty.initializer.getText().replace(/['"`]/g, '')
      : null;
  }

  try {
    // we can't statically resolve the bundler from the config, so we load the config
    const cypressConfig = await loadConfigFile(
      join(workspaceRoot, cypressConfigPath)
    );

    return cypressConfig.component?.devServer?.bundler;
  } catch {
    return null;
  }
}
