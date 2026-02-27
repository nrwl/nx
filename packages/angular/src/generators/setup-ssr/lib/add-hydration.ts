import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { insertImport } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { CallExpression, SourceFile } from 'typescript';
import {
  addProviderToAppConfig,
  addProviderToModule,
} from '../../../utils/nx-devkit/ast-utils';
import type { NormalizedGeneratorOptions } from '../schema';

let tsModule: typeof import('typescript');
let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

export function addHydration(tree: Tree, options: NormalizedGeneratorOptions) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const sourceRoot = getProjectSourceRoot(projectConfig, tree);

  if (!tsModule) {
    tsModule = ensureTypescript();
    tsquery = require('@phenomnomnominal/tsquery').tsquery;
  }

  let pathToClientConfigFile: string;
  if (options.standalone) {
    pathToClientConfigFile = joinPathFragments(sourceRoot, 'app/app.config.ts');
  } else {
    pathToClientConfigFile = joinPathFragments(sourceRoot, 'app/app.module.ts');
    if (!tree.exists(pathToClientConfigFile)) {
      pathToClientConfigFile = joinPathFragments(
        sourceRoot,
        'app/app-module.ts'
      );
    }
  }

  const sourceText = tree.read(pathToClientConfigFile, 'utf-8');
  let sourceFile = tsModule.createSourceFile(
    pathToClientConfigFile,
    sourceText,
    tsModule.ScriptTarget.Latest,
    true
  );

  const provideClientHydrationCallExpression = tsquery<CallExpression>(
    sourceFile,
    'ObjectLiteralExpression PropertyAssignment:has(Identifier[name=providers]) ArrayLiteralExpression CallExpression:has(Identifier[name=provideClientHydration])'
  )[0];
  if (provideClientHydrationCallExpression) {
    return;
  }

  const addImport = (
    source: SourceFile,
    symbolName: string,
    packageName: string,
    filePath: string,
    isDefault = false
  ): SourceFile => {
    return insertImport(
      tree,
      source,
      filePath,
      symbolName,
      packageName,
      isDefault
    );
  };

  sourceFile = addImport(
    sourceFile,
    'provideClientHydration',
    '@angular/platform-browser',
    pathToClientConfigFile
  );
  sourceFile = addImport(
    sourceFile,
    'withEventReplay',
    '@angular/platform-browser',
    pathToClientConfigFile
  );

  const provider = 'provideClientHydration(withEventReplay())';
  if (options.standalone) {
    addProviderToAppConfig(tree, pathToClientConfigFile, provider);
  } else {
    addProviderToModule(tree, sourceFile, pathToClientConfigFile, provider);
  }
}
