import {chain, noop, Rule, Tree} from '@angular-devkit/schematics';
import {addEntryComponents, addMethod, insert, readBootstrapInfo, removeFromNgModule} from '../../../../shared/ast-utils';
import {Schema} from './schema';
import {addUpgradeToPackageJson} from '../../../../shared/common';
import {wrapIntoFormat} from '../../../../shared/tasks';

function updateMain(angularJsImport: string, options: Schema): Rule {
  return (host: Tree) => {
    const {
      mainPath,
      moduleClassName,
      moduleSpec,
      bootstrapComponentClassName,
      bootstrapComponentFileName
    } = readBootstrapInfo(host, options.app);

    host.overwrite(
      mainPath,
      // prettier-ignore
      `import { enableProdMode, StaticProvider } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import * as angular from 'angular';
import { downgradeComponent, downgradeModule, setAngularLib } from '@angular/upgrade/static';

import { ${moduleClassName} } from '${moduleSpec}';
import { environment } from './environments/environment';
import '${angularJsImport}';
import { ${bootstrapComponentClassName} } from '${bootstrapComponentFileName}';

export function bootstrapAngular(extra: StaticProvider[]): any {
  setAngularLib(angular);
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
    const { modulePath, moduleSource, moduleClassName } = readBootstrapInfo(host, options.app);
    insert(host, modulePath, [
      ...addMethod(moduleSource, modulePath, {
        className: moduleClassName,
        methodHeader: 'ngDoBootstrap(): void',
        body: ``
      }),
      ...removeFromNgModule(moduleSource, modulePath, 'bootstrap')
    ]);
    return host;
  };
}
function addEntryComponentsToModule(options: Schema): Rule {
  return (host: Tree) => {
    const { modulePath, moduleSource, bootstrapComponentClassName } = readBootstrapInfo(host, options.app);
    insert(host, modulePath, addEntryComponents(moduleSource, modulePath, bootstrapComponentClassName));
    return host;
  };
}

export default function(options: Schema): Rule {
  return  wrapIntoFormat(() => {
    const angularJsImport = options.angularJsImport ? options.angularJsImport : options.name;

    return chain([
      updateMain(angularJsImport, options),
      addEntryComponentsToModule(options),
      rewriteBootstrapLogic(options),
      options.skipPackageJson ? noop() : addUpgradeToPackageJson()
    ]);
  });
}
