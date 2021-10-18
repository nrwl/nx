import type { Tree } from '@nrwl/devkit';
import { names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import type { SourceFile } from 'typescript';
import { createSourceFile, ScriptTarget } from 'typescript';
import {
  addImportToModule,
  addProviderToModule,
} from '../../../utils/nx-devkit/ast-utils';
import type { NgRxGeneratorOptions } from '../schema';

export function addImportsToModule(
  tree: Tree,
  options: NgRxGeneratorOptions
): void {
  const modulePath = options.module;
  const sourceText = tree.read(modulePath, 'utf-8');
  let sourceFile = createSourceFile(
    modulePath,
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
      modulePath,
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
  const reducerImports = `* as from${className}`;

  const storeMetaReducers = `metaReducers: !environment.production ? [] : []`;

  const storeForRoot = `StoreModule.forRoot({}, {
      ${storeMetaReducers},
      runtimeChecks: {
        strictActionImmutability: true,
        strictStateImmutability: true
      }
    })`;
  const nxModule = 'NxModule.forRoot()';
  const effectsForRoot = `EffectsModule.forRoot([${effectsName}])`;
  const effectsForEmptyRoot = `EffectsModule.forRoot([])`;
  const storeForFeature = `StoreModule.forFeature(from${className}.${constantName}_FEATURE_KEY, from${className}.reducer)`;
  const effectsForFeature = `EffectsModule.forFeature([${effectsName}])`;
  const devTools = `!environment.production ? StoreDevtoolsModule.instrument() : []`;
  const storeRouterModule = 'StoreRouterConnectingModule.forRoot()';

  // this is just a heuristic
  const hasRouter = sourceText.indexOf('RouterModule') > -1;
  const hasNxModule = sourceText.includes(nxModule);

  sourceFile = addImport(sourceFile, 'StoreModule', '@ngrx/store');
  sourceFile = addImport(sourceFile, 'EffectsModule', '@ngrx/effects');

  if (options.minimal && options.root) {
    sourceFile = addImport(
      sourceFile,
      'StoreDevtoolsModule',
      '@ngrx/store-devtools'
    );
    sourceFile = addImport(
      sourceFile,
      'environment',
      '../environments/environment'
    );

    sourceFile = addImportToModule(tree, sourceFile, modulePath, storeForRoot);
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      modulePath,
      effectsForEmptyRoot
    );
    sourceFile = addImportToModule(tree, sourceFile, modulePath, devTools);

    if (hasRouter) {
      sourceFile = addImport(
        sourceFile,
        'StoreRouterConnectingModule',
        '@ngrx/router-store'
      );
      sourceFile = addImportToModule(
        tree,
        sourceFile,
        modulePath,
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
          modulePath,
          facadeName
        );
      }

      return sourceFile;
    };

    if (options.root) {
      sourceFile = addCommonImports();

      if (!hasNxModule) {
        sourceFile = addImport(sourceFile, 'NxModule', '@nrwl/angular');
        sourceFile = addImportToModule(tree, sourceFile, modulePath, nxModule);
      }

      sourceFile = addImport(
        sourceFile,
        'StoreDevtoolsModule',
        '@ngrx/store-devtools'
      );
      sourceFile = addImport(
        sourceFile,
        'environment',
        '../environments/environment'
      );

      sourceFile = addImportToModule(
        tree,
        sourceFile,
        modulePath,
        storeForRoot
      );
      sourceFile = addImportToModule(
        tree,
        sourceFile,
        modulePath,
        effectsForRoot
      );
      sourceFile = addImportToModule(tree, sourceFile, modulePath, devTools);

      if (hasRouter) {
        sourceFile = addImport(
          sourceFile,
          'StoreRouterConnectingModule',
          '@ngrx/router-store'
        );
        sourceFile = addImportToModule(
          tree,
          sourceFile,
          modulePath,
          storeRouterModule
        );
      }

      sourceFile = addImportToModule(
        tree,
        sourceFile,
        modulePath,
        storeForFeature
      );
    } else {
      sourceFile = addCommonImports();

      sourceFile = addImportToModule(
        tree,
        sourceFile,
        modulePath,
        storeForFeature
      );
      sourceFile = addImportToModule(
        tree,
        sourceFile,
        modulePath,
        effectsForFeature
      );
    }
  }
}
