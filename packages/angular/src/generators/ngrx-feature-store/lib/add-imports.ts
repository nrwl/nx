import type { Tree } from '@nx/devkit';
import { names } from '@nx/devkit';
import type { SourceFile } from 'typescript';
import {
  addImportToModule,
  addProviderToAppConfig,
  addProviderToBootstrapApplication,
  addProviderToModule,
} from '../../../utils/nx-devkit/ast-utils';
import { addProviderToRoute } from '../../../utils/nx-devkit/route-utils';
import type { NormalizedNgRxFeatureStoreGeneratorOptions } from './normalize-options';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { insertImport } from '@nx/js';

let tsModule: typeof import('typescript');

function addStoreForFeatureImport(
  tree: Tree,
  isParentStandalone,
  route: string,
  sourceFile: SourceFile,
  parentPath: string,
  provideStoreForFeature: string,
  storeForFeature: string
) {
  if (isParentStandalone) {
    const parentContents = tree.read(parentPath, 'utf-8');
    if (parentContents.includes('ApplicationConfig')) {
      addProviderToAppConfig(tree, parentPath, provideStoreForFeature);
    } else if (parentContents.includes('bootstrapApplication')) {
      addProviderToBootstrapApplication(
        tree,
        parentPath,
        provideStoreForFeature
      );
    } else {
      addProviderToRoute(tree, parentPath, route, provideStoreForFeature);
    }
  } else {
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      parentPath,
      storeForFeature
    );
  }
  return sourceFile;
}

function addEffectsForFeatureImport(
  tree: Tree,
  isParentStandalone,
  route: string,
  sourceFile: SourceFile,
  parentPath: string,
  provideEffectsForFeature: string,
  effectsForFeature: string
) {
  if (isParentStandalone) {
    const parentContents = tree.read(parentPath, 'utf-8');
    if (parentContents.includes('ApplicationConfig')) {
      addProviderToAppConfig(tree, parentPath, provideEffectsForFeature);
    } else if (parentContents.includes('bootstrapApplication')) {
      addProviderToBootstrapApplication(
        tree,
        parentPath,
        provideEffectsForFeature
      );
    } else {
      addProviderToRoute(tree, parentPath, route, provideEffectsForFeature);
    }
  } else {
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      parentPath,
      effectsForFeature
    );
  }
  return sourceFile;
}

export function addImportsToModule(
  tree: Tree,
  options: NormalizedNgRxFeatureStoreGeneratorOptions
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

  const storeForFeature = `StoreModule.forFeature(from${className}.${constantName}_FEATURE_KEY, from${className}.${propertyName}Reducer)`;
  const effectsForFeature = `EffectsModule.forFeature([${effectsName}])`;

  const provideEffectsForFeature = `provideEffects(${effectsName})`;
  const provideStoreForFeature = `provideState(from${className}.${constantName}_FEATURE_KEY, from${className}.${propertyName}Reducer)`;

  if (isParentStandalone) {
    sourceFile = addImport(sourceFile, 'provideStore', '@ngrx/store');
    if (!options.minimal) {
      sourceFile = addImport(sourceFile, 'provideState', '@ngrx/store');
    }
    sourceFile = addImport(sourceFile, 'provideEffects', '@ngrx/effects');
  } else {
    sourceFile = addImport(sourceFile, 'StoreModule', '@ngrx/store');
    sourceFile = addImport(sourceFile, 'EffectsModule', '@ngrx/effects');
  }

  sourceFile = addImport(sourceFile, reducerImports, reducerPath, true);
  sourceFile = addImport(sourceFile, effectsName, effectsPath);

  if (options.facade) {
    sourceFile = addImport(sourceFile, facadeName, facadePath);
    if (isParentStandalone) {
      if (tree.read(parentPath, 'utf-8').includes('ApplicationConfig')) {
        addProviderToAppConfig(tree, parentPath, facadeName);
      } else {
        addProviderToRoute(tree, parentPath, options.route, facadeName);
      }
    } else {
      sourceFile = addProviderToModule(
        tree,
        sourceFile,
        parentPath,
        facadeName
      );
    }
  }

  sourceFile = addStoreForFeatureImport(
    tree,
    isParentStandalone,
    options.route,
    sourceFile,
    parentPath,
    provideStoreForFeature,
    storeForFeature
  );
  sourceFile = addEffectsForFeatureImport(
    tree,
    isParentStandalone,
    options.route,
    sourceFile,
    parentPath,
    provideEffectsForFeature,
    effectsForFeature
  );
}
