import {
  apply, branchAndMerge, chain, mergeWith, move, Rule, SchematicContext, template, Tree,
  url
} from '@angular-devkit/schematics';

import {names, toClassName, toFileName, toPropertyName} from '../utility/name-utils';
import * as path from 'path';
import * as ts from 'typescript';
import {
  addDeclarationToModule, addEntryComponents,
  addImportToModule, addMethod, addParameterToConstructor, addProviderToModule, getBootstrapComponent,
  insert, removeFromNgModule
} from '../utility/ast-utils';
import {insertImport} from '@schematics/angular/utility/route-utils';
import {Schema} from './schema';

function addImportsToModule(moduleClassName: string, options: any): Rule {
  return (host: Tree) => {
    if (!host.exists(options.module)) {
      throw new Error('Specified module does not exist');
    }

    const modulePath = options.module;

    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    insert(host, modulePath, [
      insertImport(source, modulePath, `configure${options.name}, upgradedComponents`, `./${options.name}-setup`),
      insertImport(source, modulePath, 'UpgradeModule', '@angular/upgrade/static'),
      ...addImportToModule(source, modulePath, "UpgradeModule"),
      ...addDeclarationToModule(source, modulePath, "...upgradedComponents"),
      ...addEntryComponents(source, modulePath, getBootstrapComponent(source, moduleClassName))
    ]);

    return host;
  };
}


function addNgDoBootstrapToModule(moduleClassName: string, options: Schema): Rule {
  return (host: Tree) => {
    const modulePath = options.module;

    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    insert(host, modulePath, [
      ...addParameterToConstructor(source, modulePath, {
        className: moduleClassName,
        param: 'private upgrade: UpgradeModule'
      }),
      ...addMethod(source, modulePath, {
        className: moduleClassName,
        methodHeader: 'ngDoBootstrap(): void',
        body: `
configure${options.name}(this.upgrade.injector);
this.upgrade.bootstrap(document.body, ['downgraded', '${options.name}']);
        `
      }),
      ...removeFromNgModule(source, modulePath, 'bootstrap')
    ]);

    return host;
  };
}

function createFiles(moduleClassName: string, moduleFileName: string, options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const moduleDir = path.dirname(options.module);
    const templateSource = apply(url('./files'), [
      template({
        ...options,
        tmpl: '',
        moduleFileName,
        moduleClassName,
        ...names(options.name)
      }),
      move(moduleDir)
    ]);
    const r = branchAndMerge(chain([mergeWith(templateSource)]));
    return r(host, context);
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
  const moduleFileName = path.basename(options.module, '.ts');
  const moduleClassName = `${toClassName(moduleFileName)}`;

  return chain([
    createFiles(moduleClassName, moduleFileName, options),
    addImportsToModule(moduleClassName, options),
    addNgDoBootstrapToModule(moduleClassName, options)
  ]);
}
