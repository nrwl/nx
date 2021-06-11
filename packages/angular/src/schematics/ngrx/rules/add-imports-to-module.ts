import { Rule, Tree } from '@angular-devkit/schematics';
import * as ts from 'typescript';
import { insert } from '@nrwl/workspace';
import { RequestContext } from './request-context';
import {
  addImportToModule,
  addProviderToModule,
} from '../../../utils/ast-utils';
import { Change, insertImport } from '@nrwl/workspace/src/utils/ast-utils';
import { names } from '@nrwl/devkit';

export function addImportsToModule(context: RequestContext): Rule {
  return (host: Tree) => {
    const modulePath = context.options.module;
    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    const addImport = (
      symbolName: string,
      fileName: string,
      isDefault = false
    ): Change => {
      return insertImport(source, modulePath, symbolName, fileName, isDefault);
    };

    const dir = `./${names(context.options.directory).fileName}`;
    const pathPrefix = `${dir}/${names(context.featureName).fileName}`;
    const reducerPath = `${pathPrefix}.reducer`;
    const effectsPath = `${pathPrefix}.effects`;
    const facadePath = `${pathPrefix}.facade`;

    const constantName = `${names(context.featureName).constantName}`;
    const effectsName = `${names(context.featureName).className}Effects`;
    const facadeName = `${names(context.featureName).className}Facade`;
    const className = `${names(context.featureName).className}`;
    const reducerImports = `* as from${className}`;

    const storeMetaReducers = `metaReducers: !environment.production ? [] : []`;

    const storeForRoot = `StoreModule.forRoot({},
  {
    ${storeMetaReducers},
    runtimeChecks: {
      strictActionImmutability: true,
      strictStateImmutability: true
    }
  }
)`;
    const nxModule = 'NxModule.forRoot()';
    const effectsForRoot = `EffectsModule.forRoot([${effectsName}])`;
    const effectsForEmptyRoot = `EffectsModule.forRoot([])`;
    const storeForFeature = `StoreModule.forFeature(from${className}.${constantName}_FEATURE_KEY, from${className}.reducer)`;
    const effectsForFeature = `EffectsModule.forFeature([${effectsName}])`;
    const devTools = `!environment.production ? StoreDevtoolsModule.instrument() : []`;
    const storeRouterModule = 'StoreRouterConnectingModule.forRoot()';

    // InsertImport [symbol,source] value pairs
    const nxModuleImport = ['NxModule', '@nrwl/angular'];
    const storeModule = ['StoreModule', '@ngrx/store'];
    const effectsModule = ['EffectsModule', '@ngrx/effects'];
    const storeDevTools = ['StoreDevtoolsModule', '@ngrx/store-devtools'];
    const environment = ['environment', '../environments/environment'];
    const storeRouter = ['StoreRouterConnectingModule', '@ngrx/router-store'];

    // this is just a heuristic
    const hasRouter = sourceText.indexOf('RouterModule') > -1;
    const hasNxModule = sourceText.includes('NxModule.forRoot()');

    if (
      (context.options.onlyEmptyRoot || context.options.minimal) &&
      context.options.root
    ) {
      insert(host, modulePath, [
        addImport.apply(this, storeModule),
        addImport.apply(this, effectsModule),
        addImport.apply(this, storeDevTools),
        addImport.apply(this, environment),
        ...(hasRouter ? [addImport.apply(this, storeRouter)] : []),
        ...addImportToModule(source, modulePath, storeForRoot),
        ...addImportToModule(source, modulePath, effectsForEmptyRoot),
        ...addImportToModule(source, modulePath, devTools),
        ...(hasRouter
          ? addImportToModule(source, modulePath, storeRouterModule)
          : []),
      ]);
    } else {
      let common = [
        addImport.apply(this, storeModule),
        addImport.apply(this, effectsModule),
        addImport(reducerImports, reducerPath, true),
        addImport(effectsName, effectsPath),
      ];
      if (context.options.facade) {
        common = [
          ...common,
          addImport(facadeName, facadePath),
          ...addProviderToModule(source, modulePath, `${facadeName}`),
        ];
      }

      if (context.options.root) {
        insert(host, modulePath, [
          ...common,
          ...(!hasNxModule ? [addImport.apply(this, nxModuleImport)] : []),
          addImport.apply(this, storeDevTools),
          addImport.apply(this, environment),
          ...(hasRouter ? [addImport.apply(this, storeRouter)] : []),
          ...(!hasNxModule
            ? addImportToModule(source, modulePath, nxModule)
            : []),
          ...addImportToModule(source, modulePath, storeForRoot),
          ...addImportToModule(source, modulePath, effectsForRoot),
          ...addImportToModule(source, modulePath, devTools),
          ...(hasRouter
            ? addImportToModule(source, modulePath, storeRouterModule)
            : []),
          ...addImportToModule(source, modulePath, storeForFeature),
        ]);
      } else {
        insert(host, modulePath, [
          ...common,
          ...addImportToModule(source, modulePath, storeForFeature),
          ...addImportToModule(source, modulePath, effectsForFeature),
        ]);
      }
    }
    return host;
  };
}
