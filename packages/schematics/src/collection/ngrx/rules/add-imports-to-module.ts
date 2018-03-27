import { Rule, Tree } from '@angular-devkit/schematics';
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
    if (context.options.onlyAddFiles) {
      return host;
    }

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

    if (context.options.onlyEmptyRoot) {
      insert(host, modulePath, [
        insertImport(source, modulePath, 'StoreModule', '@ngrx/store'),
        insertImport(source, modulePath, 'EffectsModule', '@ngrx/effects'),
        insertImport(
          source,
          modulePath,
          'StoreDevtoolsModule',
          '@ngrx/store-devtools'
        ),
        insertImport(
          source,
          modulePath,
          'environment',
          '../environments/environment'
        ),
        insertImport(
          source,
          modulePath,
          'StoreRouterConnectingModule',
          '@ngrx/router-store'
        ),
        insertImport(source, modulePath, 'storeFreeze', 'ngrx-store-freeze'),
        ...addImportToModule(
          source,
          modulePath,
          `StoreModule.forRoot({},{metaReducers: !environment.production ? [storeFreeze] : []})`
        ),
        ...addImportToModule(source, modulePath, `EffectsModule.forRoot([])`),
        ...addImportToModule(
          source,
          modulePath,
          `!environment.production ? StoreDevtoolsModule.instrument() : []`
        ),
        ...addImportToModule(source, modulePath, `StoreRouterConnectingModule`)
      ]);
      return host;
    } else {
      const reducerPath = `./${toFileName(
        context.options.directory
      )}/${toFileName(context.featureName)}.reducer`;
      const effectsPath = `./${toFileName(
        context.options.directory
      )}/${toFileName(context.featureName)}.effects`;
      const initPath = `./${toFileName(context.options.directory)}/${toFileName(
        context.featureName
      )}.init`;

      const reducerName = `${toPropertyName(context.featureName)}Reducer`;
      const effectsName = `${toClassName(context.featureName)}Effects`;
      const initName = `initialState`;

      const common = [
        insertImport(source, modulePath, 'StoreModule', '@ngrx/store'),
        insertImport(source, modulePath, 'EffectsModule', '@ngrx/effects'),
        insertImport(source, modulePath, reducerName, reducerPath),
        insertImport(source, modulePath, initName, initPath),
        insertImport(source, modulePath, effectsName, effectsPath),
        ...addProviderToModule(source, modulePath, effectsName)
      ];

      if (context.options.root) {
        insert(host, modulePath, [
          ...common,
          insertImport(
            source,
            modulePath,
            'StoreDevtoolsModule',
            '@ngrx/store-devtools'
          ),
          insertImport(
            source,
            modulePath,
            'environment',
            '../environments/environment'
          ),
          insertImport(
            source,
            modulePath,
            'StoreRouterConnectingModule',
            '@ngrx/router-store'
          ),
          insertImport(source, modulePath, 'storeFreeze', 'ngrx-store-freeze'),
          ...addImportToModule(
            source,
            modulePath,
            `StoreModule.forRoot({${toPropertyName(
              context.featureName
            )}: ${reducerName}}, {
              initialState: {${toPropertyName(
                context.featureName
              )}: ${initName}},
              metaReducers: !environment.production ? [storeFreeze] : []
            })`
          ),
          ...addImportToModule(
            source,
            modulePath,
            `EffectsModule.forRoot([${effectsName}])`
          ),
          ...addImportToModule(
            source,
            modulePath,
            `!environment.production ? StoreDevtoolsModule.instrument() : []`
          ),
          ...addImportToModule(
            source,
            modulePath,
            `StoreRouterConnectingModule`
          )
        ]);
      } else {
        insert(host, modulePath, [
          ...common,
          ...addImportToModule(
            source,
            modulePath,
            `StoreModule.forFeature('${toPropertyName(
              context.featureName
            )}', ${reducerName}, {initialState: ${initName}})`
          ),
          ...addImportToModule(
            source,
            modulePath,
            `EffectsModule.forFeature([${effectsName}])`
          )
        ]);
      }

      return host;
    }
  };
}
