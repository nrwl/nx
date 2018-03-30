import { Rule, Tree } from '@angular-devkit/schematics';
import {
  ngrxVersion,
  routerStoreVersion,
  ngrxStoreFreezeVersion
} from '../../../lib-versions';
import { serializeJson } from '../../../utils/fileutils';

export function addNgRxToPackageJson(): Rule {
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
    if (!json['dependencies']['@ngrx/effects']) {
      json['dependencies']['@ngrx/effects'] = ngrxVersion;
    }
    if (!json['dependencies']['@ngrx/entity']) {
      json['dependencies']['@ngrx/entity'] = ngrxVersion;
    }
    if (!json['dependencies']['@ngrx/store-devtools']) {
      json['dependencies']['@ngrx/store-devtools'] = ngrxVersion;
    }
    if (!json['dependencies']['@ngrx/router-store']) {
      json['dependencies']['@ngrx/router-store'] = routerStoreVersion;
    }
    if (!json['dependencies']['ngrx-store-freeze']) {
      json['dependencies']['ngrx-store-freeze'] = ngrxStoreFreezeVersion;
    }

    host.overwrite('package.json', serializeJson(json));
    return host;
  };
}
