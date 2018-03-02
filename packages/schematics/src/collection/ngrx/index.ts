import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';

import {names, toClassName, toFileName, toPropertyName} from '../../../../shared/name-utils';
import * as path from 'path';
import * as ts from 'typescript';
import {addImportToModule, addProviderToModule, insert} from '../../../../shared/ast-utils';
import {insertImport} from '@schematics/angular/utility/route-utils';
import {Schema} from './schema';
import {ngrxVersion, routerStoreVersion} from '../../../../shared/lib-versions';
import {serializeJson} from '../../../../shared/fileutils';
import {wrapIntoFormat} from '../../../../shared/tasks';

function addImportsToModule(name: string, options: Schema): Rule {
  return (host: Tree) => {
    if (options.onlyAddFiles) {
      return host;
    }

    if (!host.exists(options.module)) {
      throw new Error('Specified module does not exist');
    }

    const modulePath = options.module;

    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    if (options.onlyEmptyRoot) {
      insert(host, modulePath, [
        insertImport(source, modulePath, 'StoreModule', '@ngrx/store'),
        insertImport(source, modulePath, 'EffectsModule', '@ngrx/effects'),
        insertImport(source, modulePath, 'StoreDevtoolsModule', '@ngrx/store-devtools'),
        insertImport(source, modulePath, 'environment', '../environments/environment'),
        insertImport(source, modulePath, 'StoreRouterConnectingModule', '@ngrx/router-store'),
        ...addImportToModule(source, modulePath, `StoreModule.forRoot({})`),
        ...addImportToModule(source, modulePath, `EffectsModule.forRoot([])`),
        ...addImportToModule(source, modulePath, `!environment.production ? StoreDevtoolsModule.instrument() : []`),
        ...addImportToModule(source, modulePath, `StoreRouterConnectingModule`)
      ]);
      return host;
    } else {
      const reducerPath = `./${toFileName(options.directory)}/${toFileName(name)}.reducer`;
      const effectsPath = `./${toFileName(options.directory)}/${toFileName(name)}.effects`;
      const initPath = `./${toFileName(options.directory)}/${toFileName(name)}.init`;

      const reducerName = `${toPropertyName(name)}Reducer`;
      const effectsName = `${toClassName(name)}Effects`;
      const initName = `${toPropertyName(name)}InitialState`;

      const common = [
        insertImport(source, modulePath, 'StoreModule', '@ngrx/store'),
        insertImport(source, modulePath, 'EffectsModule', '@ngrx/effects'),
        insertImport(source, modulePath, reducerName, reducerPath),
        insertImport(source, modulePath, initName, initPath),
        insertImport(source, modulePath, effectsName, effectsPath),
        ...addProviderToModule(source, modulePath, effectsName)
      ];

      if (options.root) {
        insert(host, modulePath, [
          ...common,
          insertImport(source, modulePath, 'StoreDevtoolsModule', '@ngrx/store-devtools'),
          insertImport(source, modulePath, 'environment', '../environments/environment'),
          insertImport(source, modulePath, 'StoreRouterConnectingModule', '@ngrx/router-store'),
          ...addImportToModule(
            source,
            modulePath,
            `StoreModule.forRoot({${toPropertyName(name)}: ${reducerName}}, {initialState: {${toPropertyName(
              name
            )}: ${initName}}})`
          ),
          ...addImportToModule(source, modulePath, `EffectsModule.forRoot([${effectsName}])`),
          ...addImportToModule(source, modulePath, `!environment.production ? StoreDevtoolsModule.instrument() : []`),
          ...addImportToModule(source, modulePath, `StoreRouterConnectingModule`)
        ]);
      } else {
        insert(host, modulePath, [
          ...common,
          ...addImportToModule(
            source,
            modulePath,
            `StoreModule.forFeature('${toPropertyName(name)}', ${reducerName}, {initialState: ${initName}})`
          ),
          ...addImportToModule(source, modulePath, `EffectsModule.forFeature([${effectsName}])`)
        ]);
      }

      return host;
    }
  };
}

function addNgRxToPackageJson() {
  return (host: Tree) => {
    if (!host.exists('package.json')) return host;

    const sourceText = host.read('package.json')!.toString('utf-8');
    const json = JSON.parse(sourceText);
    if (!json['dependencies']) {
      json['dependencies'] = {};
    }

    if (!json['dependencies']['@ngrx/store']) {
      json['dependencies']['@ngrx/store'] = ngrxVersion;
    }
    if (!json['dependencies']['@ngrx/router-store']) {
      json['dependencies']['@ngrx/router-store'] = routerStoreVersion;
    }
    if (!json['dependencies']['@ngrx/effects']) {
      json['dependencies']['@ngrx/effects'] = ngrxVersion;
    }
    if (!json['dependencies']['@ngrx/store-devtools']) {
      json['dependencies']['@ngrx/store-devtools'] = ngrxVersion;
    }
    host.overwrite('package.json', serializeJson(json));
    return host;
  };
}

export default function(options: Schema): Rule {
  return wrapIntoFormat(() => {
    const name = options.name;
    const moduleDir = path.dirname(options.module);

    if (options.onlyEmptyRoot) {
      return chain([addImportsToModule(name, options), options.skipPackageJson ? noop() : addNgRxToPackageJson()]);
    } else {
      const templateSource = apply(url('./files'), [template({...options, tmpl: '', ...names(name)}), move(moduleDir)]);
      return chain([
        branchAndMerge(chain([mergeWith(templateSource)])),
        addImportsToModule(name, options),
        options.skipPackageJson ? noop() : addNgRxToPackageJson()
      ]);
    }
  });
}
