import {apply, branchAndMerge, chain, mergeWith, move, Rule, template, Tree, url} from '@angular-devkit/schematics';

import {names, toClassName, toFileName, toPropertyName} from '../utility/name-utils';
import * as path from 'path';
import * as ts from 'typescript';
import {
  addImportToModule, addMethod, addParameterToConstructor, addProviderToModule,
  insert, removeFromNgModule
} from '../utility/ast-utils';
import {insertImport} from '@schematics/angular/utility/route-utils';
import {Schema} from './schema';

function addImportsToModule(options: any): Rule {
  return (host: Tree) => {
    if (!host.exists(options.module)) {
      throw new Error('Specified module does not exist');
    }

    const modulePath = options.module;

    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    insert(host, modulePath, [
      insertImport(source, modulePath, `configure${options.name}`, `./${options.name}-setup`),
      insertImport(source, modulePath, 'setAngularLib', '@angular/upgrade/static'),
      insertImport(source, modulePath, 'UpgradeModule', '@angular/upgrade/static'),
      ...addImportToModule(source, modulePath, "UpgradeModule")
    ]);

    return host;
  };
}


function addNgDoBootstrapToModule(options: Schema): Rule {
  return (host: Tree) => {
    const modulePath = options.module;

    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    insert(host, modulePath, [
      ...addParameterToConstructor(source, modulePath, {
        className: 'AppModule',
        param: 'private upgrade: UpgradeModule'
      }),
      ...addMethod(source, modulePath, {
        className: 'AppModule',
        methodHeader: 'ngDoBootstrap(): void',
        body: `
setAngularLib((<any>window).angular);
configure${options.name}(this.upgrade.injector);
this.upgrade.bootstrap(document.body, ['${options.name}']);
        `
      }),
      ...removeFromNgModule(source, modulePath, 'bootstrap')
    ]);

    return host;
  };
}

/**
 * DONE Remove bootstrap:
 * DONE Add ngDoBootstrap
 * DONE Import UpgradeModule
 * DONE Import angular with a comment that it can be removed
 * DONE Reset globalAngular right before that
 * DONE Inject UpgradeModule and call upgrade.bootstrap()
 * Add hybrid.spec.ts checking that everything bootstraps successfully
 * Change package.json to add upgrade???
 *
 */

export default function (options: Schema): Rule {
  const moduleDir = path.dirname(options.module);

  const templateSource = apply(url('./files'), [template({...options, tmpl: '', ...names(options.name)}), move(moduleDir)]);
  return chain([
    branchAndMerge(chain([mergeWith(templateSource)])),
    addImportsToModule(options),
    addNgDoBootstrapToModule(options)
  ]);
}
