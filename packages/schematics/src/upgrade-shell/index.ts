import {
  apply, branchAndMerge, chain, mergeWith, move, noop, Rule, SchematicContext, template, Tree,
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
import {angularJsVersion} from '../utility/lib-versions';


function addImportsToModule(moduleClassName: string, angularJsModule: string, options: Schema): Rule {
  return (host: Tree) => {
    if (!host.exists(options.module)) {
      throw new Error('Specified module does not exist');
    }

    const modulePath = options.module;

    const sourceText = host.read(modulePath)!.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    insert(host, modulePath, [
      insertImport(source, modulePath, `configure${toClassName(angularJsModule)}, upgradedComponents`, `./${toFileName(angularJsModule)}-setup`),
      insertImport(source, modulePath, 'UpgradeModule', '@angular/upgrade/static'),
      ...addImportToModule(source, modulePath, "UpgradeModule"),
      ...addDeclarationToModule(source, modulePath, "...upgradedComponents"),
      ...addEntryComponents(source, modulePath, getBootstrapComponent(source, moduleClassName))
    ]);

    return host;
  };
}


function addNgDoBootstrapToModule(moduleClassName: string, angularJsModule: string, options: Schema): Rule {
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
configure${toClassName(angularJsModule)}(this.upgrade.injector);
this.upgrade.bootstrap(document.body, ['downgraded', '${angularJsModule}']);
        `
      }),
      ...removeFromNgModule(source, modulePath, 'bootstrap')
    ]);

    return host;
  };
}

function createFiles(moduleClassName: string, moduleFileName: string, angularJsModule: string, options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const modulePath = options.module;
    const moduleSourceText = host.read(modulePath)!.toString('utf-8');
    const moduleSource = ts.createSourceFile(modulePath, moduleSourceText, ts.ScriptTarget.Latest, true);

    const bootstrapComponentClassName = getBootstrapComponent(moduleSource, moduleClassName);
    const bootstrapComponentFileName = `${toFileName(bootstrapComponentClassName.substring(0, bootstrapComponentClassName.length - 9))}.component`;

    const moduleDir = path.dirname(options.module);
    const templateSource = apply(url('./files'), [
      template({
        ...options,
        tmpl: '',
        moduleFileName,
        moduleClassName,
        angularJsModule,
        bootstrapComponentClassName,
        bootstrapComponentFileName,
        ...names(angularJsModule)
      }),
      move(moduleDir)
    ]);
    const r = branchAndMerge(chain([mergeWith(templateSource)]));
    return r(host, context);
  };
}


function addUpgradeToPackageJson() {
  return (host: Tree) => {
    if (!host.exists("package.json")) return host;

    const sourceText = host.read('package.json')!.toString('utf-8');
    const json = JSON.parse(sourceText);
    if (! json['dependencies']) {
      json['dependencies'] = {};
    }

    if (! json['dependencies']['@angular/upgrade']) {
      json['dependencies']['@angular/upgrade'] = json['dependencies']['@angular/core'];
    }
    if (! json['dependencies']['angular']) {
      json['dependencies']['angular'] = angularJsVersion;
    }

    host.overwrite('package.json', JSON.stringify(json, null, 2));
    return host;
  };
}

export default function (options: Schema): Rule {
  const moduleFileName = path.basename(options.module, '.ts');
  const moduleClassName = `${toClassName(moduleFileName)}`;
  const angularJsModule = options.angularJsModule ? options.angularJsModule : path.basename(options.angularJsImport);

  return chain([
    createFiles(moduleClassName, moduleFileName, angularJsModule, options),
    addImportsToModule(moduleClassName, angularJsModule, options),
    addNgDoBootstrapToModule(moduleClassName, angularJsModule, options),
    options.skipPackageJson ? noop() : addUpgradeToPackageJson()
  ]);
}
