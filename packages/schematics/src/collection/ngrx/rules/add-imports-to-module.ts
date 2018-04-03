import { Rule, Tree } from '@angular-devkit/schematics';
import { Change } from '@ngrx/schematics/src/utility/change';
import { insertImport } from '@schematics/angular/utility/route-utils';
import * as ts from 'typescript';
import {
  toClassName,
  toFileName,
  toPropertyName
} from '../../../utils/name-utils';
import {
  insert,
  addImportToModule,
  addProviderToModule
} from '../../../utils/ast-utils';
import { RequestContext } from './request-context';

export function addImportsToModule(context: RequestContext): Rule {
  return (host: Tree) => {
    if (!host.exists(context.options.module)) {
      throw new Error('Specified module does not exist');
    }
    const modulePath = context.options.module;
    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    const addImport = (symbolName: string, fileName: string): Change => {
      return insertImport(source, modulePath, symbolName, fileName);
    };

    const dir = `./${toFileName(context.options.directory)}`;
    const pathPrefix = `${dir}/${toFileName(context.featureName)}`;
    const reducerPath = `${pathPrefix}.reducer`;
    const effectsPath = `${pathPrefix}.effects`;

    const featureName = `${toPropertyName(context.featureName)}`;
    const reducerName = `${toPropertyName(context.featureName)}Reducer`;
    const effectsName = `${toClassName(context.featureName)}Effects`;
    const reducerImports = `${reducerName}, initialState as ${featureName}InitialState`;

    const storeReducers = `{ ${featureName}: ${reducerName} }`;
    const storeInitState = `initialState : { ${featureName} : ${featureName}InitialState }`;
    const storeMetaReducers = `metaReducers : !environment.production ? [storeFreeze] : []`;

    const storeForRoot = `StoreModule.forRoot(
  ${storeReducers},
  {
    ${storeInitState},
    ${storeMetaReducers}
  }
)`;
    const storeForEmptyRoot = `StoreModule.forRoot({},{ ${storeMetaReducers} })`;
    const effectsForRoot = `EffectsModule.forRoot([${effectsName}])`;
    const effectsForEmptyRoot = `EffectsModule.forRoot([])`;
    const storeForFeature = `StoreModule.forFeature('${featureName}', ${reducerName}, { initialState: ${featureName}InitialState })`;
    const effectsForFeature = `EffectsModule.forFeature([${effectsName}])`;
    const devTools = `!environment.production ? StoreDevtoolsModule.instrument() : []`;
    const storeRouterModule = 'StoreRouterConnectingModule';

    // InsertImport [symbol,source] value pairs
    const storeModule = ['StoreModule', '@ngrx/store'];
    const effectsModule = ['EffectsModule', '@ngrx/effects'];
    const storeDevTools = ['StoreDevtoolsModule', '@ngrx/store-devtools'];
    const environment = ['environment', '../environments/environment'];
    const storeRouter = ['StoreRouterConnectingModule', '@ngrx/router-store'];
    const storeFreeze = ['storeFreeze', 'ngrx-store-freeze'];

    // this is just a heuristic
    const hasRouter = sourceText.indexOf('RouterModule') > -1;

    if (context.options.onlyEmptyRoot) {
      insert(host, modulePath, [
        addImport.apply(this, storeModule),
        addImport.apply(this, effectsModule),
        addImport.apply(this, storeDevTools),
        addImport.apply(this, environment),
        ...(hasRouter ? [addImport.apply(this, storeRouter)] : []),
        addImport.apply(this, storeFreeze),
        ...addImportToModule(source, modulePath, storeForEmptyRoot),
        ...addImportToModule(source, modulePath, effectsForEmptyRoot),
        ...addImportToModule(source, modulePath, devTools),
        ...(hasRouter
          ? addImportToModule(source, modulePath, storeRouterModule)
          : [])
      ]);
    } else {
      const common = [
        addImport.apply(this, storeModule),
        addImport.apply(this, effectsModule),
        addImport(reducerImports, reducerPath),
        addImport(effectsName, effectsPath),
        ...addProviderToModule(source, modulePath, effectsName)
      ];

      if (context.options.root) {
        insert(host, modulePath, [
          ...common,
          addImport.apply(this, storeDevTools),
          addImport.apply(this, environment),
          ...(hasRouter ? [addImport.apply(this, storeRouter)] : []),
          addImport.apply(this, storeFreeze),
          ...addImportToModule(source, modulePath, storeForRoot),
          ...addImportToModule(source, modulePath, effectsForRoot),
          ...addImportToModule(source, modulePath, devTools),
          ...(hasRouter
            ? addImportToModule(source, modulePath, storeRouterModule)
            : [])
        ]);
      } else {
        insert(host, modulePath, [
          ...common,
          ...addImportToModule(source, modulePath, storeForFeature),
          ...addImportToModule(source, modulePath, effectsForFeature)
        ]);
      }
    }
    return host;
  };
}
