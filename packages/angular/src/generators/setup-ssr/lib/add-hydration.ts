import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { insertImport } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { CallExpression, SourceFile } from 'typescript';
import {
  addProviderToAppConfig,
  addProviderToModule,
} from '../../../utils/nx-devkit/ast-utils';
import { type Schema } from '../schema';

let tsModule: typeof import('typescript');
let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

export function addHydration(tree: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (!tsModule) {
    tsModule = ensureTypescript();
    tsquery = require('@phenomnomnominal/tsquery').tsquery;
  }

  const pathToClientConfigFile = options.standalone
    ? joinPathFragments(projectConfig.sourceRoot, 'app/app.config.ts')
    : joinPathFragments(projectConfig.sourceRoot, 'app/app.module.ts');

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

  if (options.standalone) {
    addProviderToAppConfig(
      tree,
      pathToClientConfigFile,
      'provideClientHydration()'
    );
  } else {
    addProviderToModule(
      tree,
      sourceFile,
      pathToClientConfigFile,
      'provideClientHydration()'
    );
  }
}
