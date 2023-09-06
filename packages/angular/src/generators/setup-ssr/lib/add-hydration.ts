import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { type Schema } from '../schema';
import {
  addProviderToAppConfig,
  addProviderToModule,
} from '../../../utils/nx-devkit/ast-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { SourceFile } from 'typescript';
import { insertImport } from '@nx/js';

let tsModule: typeof import('typescript');

export function addHydration(tree: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (!tsModule) {
    tsModule = ensureTypescript();
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
