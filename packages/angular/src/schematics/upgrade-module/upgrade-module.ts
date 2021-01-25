import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';

import * as path from 'path';
import { addMethod, addParameterToConstructor, insert } from '@nrwl/workspace';
import { Schema } from './schema';
import { addUpgradeToPackageJson } from '../../utils/upgrade';
import { formatFiles } from '@nrwl/workspace';
import {
  addDeclarationToModule,
  addEntryComponents,
  addImportToModule,
  getBootstrapComponent,
  readBootstrapInfo,
  removeFromNgModule,
} from '../../utils/ast-utils';
import { insertImport } from '@nrwl/workspace/src/utils/ast-utils';
import { names } from '@nrwl/devkit';

function addImportsToModule(options: Schema): Rule {
  return (host: Tree) => {
    const { moduleClassName, modulePath, moduleSource } = readBootstrapInfo(
      host,
      options.project
    );

    insert(host, modulePath, [
      insertImport(
        moduleSource,
        modulePath,
        `configure${names(options.name).className}, upgradedComponents`,
        `../${names(options.name).fileName}-setup`
      ),
      insertImport(
        moduleSource,
        modulePath,
        'UpgradeModule',
        '@angular/upgrade/static'
      ),
      ...addImportToModule(moduleSource, modulePath, 'UpgradeModule'),
      ...addDeclarationToModule(
        moduleSource,
        modulePath,
        '...upgradedComponents'
      ),
      ...addEntryComponents(
        moduleSource,
        modulePath,
        getBootstrapComponent(moduleSource, moduleClassName)
      ),
    ]);

    return host;
  };
}

function addNgDoBootstrapToModule(options: Schema): Rule {
  return (host: Tree) => {
    const { moduleClassName, modulePath, moduleSource } = readBootstrapInfo(
      host,
      options.project
    );

    insert(host, modulePath, [
      ...addParameterToConstructor(moduleSource, modulePath, {
        className: moduleClassName,
        param: 'private upgrade: UpgradeModule',
      }),
      ...addMethod(moduleSource, modulePath, {
        className: moduleClassName,
        methodHeader: 'ngDoBootstrap(): void',
        body: `
configure${names(options.name).className}(this.upgrade.injector);
this.upgrade.bootstrap(document.body, ['downgraded', '${options.name}']);
        `,
      }),
      ...removeFromNgModule(moduleSource, modulePath, 'bootstrap'),
    ]);

    return host;
  };
}

function createFiles(angularJsImport: string, options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const {
      moduleClassName,
      mainPath,
      moduleSpec,
      bootstrapComponentClassName,
      bootstrapComponentFileName,
    } = readBootstrapInfo(host, options.project);

    const dir = path.dirname(mainPath);
    const templateSource = apply(url('./files'), [
      template({
        ...options,
        tmpl: '',
        moduleFileName: moduleSpec,
        moduleClassName,
        angularJsImport,
        angularJsModule: options.name,
        bootstrapComponentClassName,
        bootstrapComponentFileName,
        ...names(options.name),
      }),
      move(dir),
    ]);
    const r = branchAndMerge(chain([mergeWith(templateSource)]));
    return r(host, context);
  };
}

export default function (options: Schema): Rule {
  const angularJsImport = options.angularJsImport
    ? options.angularJsImport
    : options.name;

  return chain([
    createFiles(angularJsImport, options),
    addImportsToModule(options),
    addNgDoBootstrapToModule(options),
    options.skipPackageJson ? noop() : addUpgradeToPackageJson(),
    formatFiles(options),
  ]);
}
