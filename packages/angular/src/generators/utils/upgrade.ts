import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { installPackagesTask, updateJson } from '@nrwl/devkit';
import { angularJsVersion } from '../../utils/versions';

export function addUpgradeToPackageJson(tree: Tree): GeneratorCallback {
  updateJson(tree, './package.json', (json) => {
    json.dependencies = {
      '@angular/upgrade': json.dependencies['@angular/core'],
      angular: angularJsVersion,
      ...(json.dependencies ?? {}),
    };
    json.dependencies = sortObjectByKeys(json.dependencies);

    return json;
  });

  return () => {
    installPackagesTask(tree);
  };
}

function sortObjectByKeys(obj: unknown): unknown {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      return {
        ...result,
        [key]: obj[key],
      };
    }, {});
}
