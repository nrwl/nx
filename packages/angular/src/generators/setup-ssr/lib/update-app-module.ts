import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import type { Schema } from '../schema';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';

export function updateAppModule(tree: Tree, schema: Schema) {
  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');
  // read the content of app module
  const projectConfig = readProjectConfiguration(tree, schema.project);
  const pathToAppModule = joinPathFragments(
    projectConfig.sourceRoot,
    'app/app.module.ts'
  );
  const fileContents = tree.read(pathToAppModule, 'utf-8');

  const ast = tsquery.ast(fileContents);
  const browserModuleImportNodes = tsquery(
    ast,
    'PropertyAssignment:has(Identifier[name=imports]) > ArrayLiteralExpression Identifier[name=BrowserModule]',
    { visitAllChildren: true }
  );

  if (browserModuleImportNodes.length === 0) {
    throw new Error(
      `Could not find BrowserModule declaration in ${pathToAppModule}. Please ensure this is correct.`
    );
  }

  const browserModuleNode = browserModuleImportNodes[0];

  const newFileContents = `${fileContents.slice(
    0,
    browserModuleNode.getEnd()
  )}.withServerTransition({ appId: '${schema.appId}' })${fileContents.slice(
    browserModuleNode.getEnd(),
    fileContents.length
  )}`;

  tree.write(pathToAppModule, newFileContents);
}
