import type { Tree } from '@nrwl/devkit';
import { names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import type { SourceFile } from 'typescript';
import { createSourceFile, ScriptTarget } from 'typescript';
import {
  addImportToModule,
  addProviderToModule,
} from '../../../utils/nx-devkit/ast-utils';
import type { NormalizedNgRxGeneratorOptions } from './normalize-options';

export function addImportsToModule(
  tree: Tree,
  options: NormalizedNgRxGeneratorOptions
): void {
  const parentPath = options.module ?? options.parent;
  const sourceText = tree.read(parentPath, 'utf-8');
  let sourceFile = createSourceFile(
    parentPath,
    sourceText,
    ScriptTarget.Latest,
    true
  );
  const addImport = (
    source: SourceFile,
    symbolName: string,
    fileName: string,
    isDefault = false
  ): SourceFile => {
    return insertImport(
      tree,
      source,
      parentPath,
      symbolName,
      fileName,
      isDefault
    );
  };

  const dir = `./${names(options.directory).fileName}`;
  const pathPrefix = `${dir}/${names(options.name).fileName}`;
  const reducerPath = `${pathPrefix}.reducer`;
  const effectsPath = `${pathPrefix}.effects`;
  const facadePath = `${pathPrefix}.facade`;

  const constantName = `${names(options.name).constantName}`;
  const effectsName = `${names(options.name).className}Effects`;
  const facadeName = `${names(options.name).className}Facade`;
  const className = `${names(options.name).className}`;
  const propertyName = `${names(options.name).propertyName}`;
  const reducerImports = `* as from${className}`;

  const storeMetaReducers = `metaReducers: []`;

  const storeForRoot = `StoreModule.forRoot({}, {
      ${storeMetaReducers},
      runtimeChecks: {
        strictActionImmutability: true,
        strictStateImmutability: true
      }
    })`;
  const effectsForRoot = `EffectsModule.forRoot([${effectsName}])`;
  const effectsForEmptyRoot = `EffectsModule.forRoot([])`;
  const storeForFeature = `StoreModule.forFeature(from${className}.${constantName}_FEATURE_KEY, from${className}.${propertyName}Reducer)`;
  const effectsForFeature = `EffectsModule.forFeature([${effectsName}])`;
  const storeRouterModule = 'StoreRouterConnectingModule.forRoot()';

  // this is just a heuristic
  const hasRouter = sourceText.indexOf('RouterModule') > -1;

  sourceFile = addImport(sourceFile, 'StoreModule', '@ngrx/store');
  sourceFile = addImport(sourceFile, 'EffectsModule', '@ngrx/effects');

  if (options.minimal && options.root) {
    sourceFile = addImportToModule(tree, sourceFile, parentPath, storeForRoot);
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      parentPath,
      effectsForEmptyRoot
    );

    if (hasRouter) {
      sourceFile = addImport(
        sourceFile,
        'StoreRouterConnectingModule',
        '@ngrx/router-store'
      );
      sourceFile = addImportToModule(
        tree,
        sourceFile,
        parentPath,
        storeRouterModule
      );
    }
  } else {
    const addCommonImports = (): SourceFile => {
      sourceFile = addImport(sourceFile, reducerImports, reducerPath, true);
      sourceFile = addImport(sourceFile, effectsName, effectsPath);

      if (options.facade) {
        sourceFile = addImport(sourceFile, facadeName, facadePath);
        sourceFile = addProviderToModule(
          tree,
          sourceFile,
          parentPath,
          facadeName
        );
      }

      return sourceFile;
    };

    if (options.root) {
      sourceFile = addCommonImports();

      sourceFile = addImportToModule(
        tree,
        sourceFile,
        parentPath,
        storeForRoot
      );
      sourceFile = addImportToModule(
        tree,
        sourceFile,
        parentPath,
        effectsForRoot
      );

      if (hasRouter) {
        sourceFile = addImport(
          sourceFile,
          'StoreRouterConnectingModule',
          '@ngrx/router-store'
        );
        sourceFile = addImportToModule(
          tree,
          sourceFile,
          parentPath,
          storeRouterModule
        );
      }

      sourceFile = addImportToModule(
        tree,
        sourceFile,
        parentPath,
        storeForFeature
      );
    } else {
      sourceFile = addCommonImports();

      sourceFile = addImportToModule(
        tree,
        sourceFile,
        parentPath,
        storeForFeature
      );
      sourceFile = addImportToModule(
        tree,
        sourceFile,
        parentPath,
        effectsForFeature
      );
    }
  }
}
