import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { addMethod, insert } from '@nrwl/workspace';
import { Schema } from './schema';
import { formatFiles } from '@nrwl/workspace';
import { addUpgradeToPackageJson } from '../../utils/upgrade';
import {
  addEntryComponents,
  readBootstrapInfo,
  removeFromNgModule,
} from '../../utils/ast-utils';

function updateMain(angularJsImport: string, options: Schema): Rule {
  return (host: Tree) => {
    const {
      mainPath,
      moduleClassName,
      moduleSpec,
      bootstrapComponentClassName,
      bootstrapComponentFileName,
    } = readBootstrapInfo(host, options.project);

    host.overwrite(
      mainPath,
      // prettier-ignore
      `import { enableProdMode, StaticProvider } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import * as angular from 'angular';
import { downgradeComponent, downgradeModule, setAngularJSGlobal } from '@angular/upgrade/static';

import { ${moduleClassName} } from '${moduleSpec}';
import { environment } from './environments/environment';
import '${angularJsImport}';
import { ${bootstrapComponentClassName} } from '${bootstrapComponentFileName}';

export function bootstrapAngular(extra: StaticProvider[]): any {
  setAngularJSGlobal(angular);
  if (environment.production) {
    enableProdMode();
  }
  return platformBrowserDynamic(extra)
    .bootstrapModule(${moduleClassName})
    .catch(err => console.log(err));
}

const downgraded = angular
  .module('downgraded', [downgradeModule(bootstrapAngular)])
  .directive('appRoot', downgradeComponent({ component: ${bootstrapComponentClassName}, propagateDigest: false }));

angular.bootstrap(document, ['${options.name}', downgraded.name]);`
    );

    return host;
  };
}

function rewriteBootstrapLogic(options: Schema): Rule {
  return (host: Tree) => {
    const { modulePath, moduleSource, moduleClassName } = readBootstrapInfo(
      host,
      options.project
    );
    insert(host, modulePath, [
      ...addMethod(moduleSource, modulePath, {
        className: moduleClassName,
        methodHeader: 'ngDoBootstrap(): void',
        body: ``,
      }),
      ...removeFromNgModule(moduleSource, modulePath, 'bootstrap'),
    ]);
    return host;
  };
}
function addEntryComponentsToModule(options: Schema): Rule {
  return (host: Tree) => {
    const {
      modulePath,
      moduleSource,
      bootstrapComponentClassName,
    } = readBootstrapInfo(host, options.project);
    insert(
      host,
      modulePath,
      addEntryComponents(moduleSource, modulePath, bootstrapComponentClassName)
    );
    return host;
  };
}

export default function (options: Schema): Rule {
  const angularJsImport = options.angularJsImport
    ? options.angularJsImport
    : options.name;

  return chain([
    updateMain(angularJsImport, options),
    addEntryComponentsToModule(options),
    rewriteBootstrapLogic(options),
    options.skipPackageJson ? noop() : addUpgradeToPackageJson(),
    formatFiles(options),
  ]);
}
