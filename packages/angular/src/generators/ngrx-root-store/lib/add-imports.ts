import type { Tree } from '@nx/devkit';
import type { SourceFile } from 'typescript';
import {
  addImportToModule,
  addProviderToAppConfig,
  addProviderToBootstrapApplication,
} from '../../../utils/nx-devkit/ast-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { insertImport } from '@nx/js';
import { NormalizedNgRxRootStoreGeneratorOptions } from './normalize-options';

let tsModule: typeof import('typescript');

function addRootStoreImport(
  tree: Tree,
  isParentStandalone: boolean,
  sourceFile: SourceFile,
  parentPath: string,
  provideRootStore: string,
  storeForRoot: string
) {
  if (isParentStandalone) {
    if (tree.read(parentPath, 'utf-8').includes('ApplicationConfig')) {
      addProviderToAppConfig(tree, parentPath, provideRootStore);
    } else {
      addProviderToBootstrapApplication(tree, parentPath, provideRootStore);
    }
  } else {
    sourceFile = addImportToModule(tree, sourceFile, parentPath, storeForRoot);
  }
  return sourceFile;
}

function addRootEffectsImport(
  tree: Tree,
  isParentStandalone: boolean,
  sourceFile: SourceFile,
  parentPath: string,
  provideRootEffects: string,
  effectsForEmptyRoot: string
) {
  if (isParentStandalone) {
    if (tree.read(parentPath, 'utf-8').includes('ApplicationConfig')) {
      addProviderToAppConfig(tree, parentPath, provideRootEffects);
    } else {
      addProviderToBootstrapApplication(tree, parentPath, provideRootEffects);
    }
  } else {
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      parentPath,
      effectsForEmptyRoot
    );
  }

  return sourceFile;
}

function addRouterStoreImport(
  tree: Tree,
  sourceFile: SourceFile,
  addImport: (
    source: SourceFile,
    symbolName: string,
    fileName: string,
    isDefault?: boolean
  ) => SourceFile,
  parentPath: string,
  storeRouterModule: string
) {
  sourceFile = addImport(
    sourceFile,
    'StoreRouterConnectingModule',
    '@ngrx/router-store'
  );
  return addImportToModule(tree, sourceFile, parentPath, storeRouterModule);
}

function addStoreDevTools(
  tree: Tree,
  sourceFile: SourceFile,
  parentPath: string,
  isParentStandalone: boolean,
  addImport: (
    source: SourceFile,
    symbolName: string,
    fileName: string,
    isDefault?: boolean
  ) => SourceFile
): SourceFile {
  sourceFile = addImport(sourceFile, 'isDevMode', '@angular/core');
  if (isParentStandalone) {
    sourceFile = addImport(
      sourceFile,
      'provideStoreDevtools',
      '@ngrx/store-devtools'
    );

    const provideStoreDevTools =
      'provideStoreDevtools({ logOnly: !isDevMode() })';
    if (tree.read(parentPath, 'utf-8').includes('ApplicationConfig')) {
      addProviderToAppConfig(tree, parentPath, provideStoreDevTools);
    } else {
      addProviderToBootstrapApplication(tree, parentPath, provideStoreDevTools);
    }
  } else {
    sourceFile = addImport(
      sourceFile,
      'StoreDevtoolsModule',
      '@ngrx/store-devtools'
    );

    const storeDevToolsModule =
      'StoreDevtoolsModule.instrument({ logOnly: !isDevMode() })';
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      parentPath,
      storeDevToolsModule
    );
  }

  return sourceFile;
}

export function addImportsToModule(
  tree: Tree,
  options: NormalizedNgRxRootStoreGeneratorOptions
): void {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const parentPath = options.parent;
  const sourceText = tree.read(parentPath, 'utf-8');
  let sourceFile = tsModule.createSourceFile(
    parentPath,
    sourceText,
    tsModule.ScriptTarget.Latest,
    true
  );

  const isParentStandalone = !sourceText.includes('@NgModule');

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

  const storeMetaReducers = `metaReducers: []`;

  const storeForRoot = `StoreModule.forRoot({}, {
      ${storeMetaReducers},
      runtimeChecks: {
        strictActionImmutability: true,
        strictStateImmutability: true
      }
    })`;
  const effectsForEmptyRoot = `EffectsModule.forRoot([])`;
  const storeRouterModule = 'StoreRouterConnectingModule.forRoot()';

  const provideRootStore = `provideStore()`;
  const provideRootEffects = `provideEffects()`;

  if (isParentStandalone) {
    sourceFile = addImport(sourceFile, 'provideStore', '@ngrx/store');
    sourceFile = addImport(sourceFile, 'provideEffects', '@ngrx/effects');
  } else {
    sourceFile = addImport(sourceFile, 'StoreModule', '@ngrx/store');
    sourceFile = addImport(sourceFile, 'EffectsModule', '@ngrx/effects');
  }

  sourceFile = addRootStoreImport(
    tree,
    isParentStandalone,
    sourceFile,
    parentPath,
    provideRootStore,
    storeForRoot
  );

  sourceFile = addRootEffectsImport(
    tree,
    isParentStandalone,
    sourceFile,
    parentPath,
    provideRootEffects,
    effectsForEmptyRoot
  );

  // this is just a heuristic
  const hasRouter = sourceText.indexOf('RouterModule') > -1;

  if (hasRouter && !isParentStandalone) {
    sourceFile = addRouterStoreImport(
      tree,
      sourceFile,
      addImport,
      parentPath,
      storeRouterModule
    );
  }

  if (options.addDevTools) {
    sourceFile = addStoreDevTools(
      tree,
      sourceFile,
      parentPath,
      isParentStandalone,
      addImport
    );
  }
}
