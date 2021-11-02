import { chain, noop, Tree } from '@angular-devkit/schematics';
import {
  updatePackagesInPackageJson,
  formatFiles,
  updateJsonInTree,
} from '@nrwl/workspace';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../..', 'migrations.json'),
  '10.3.0'
);

const addLintRule = (host: Tree) => {
  return host.exists('.eslintrc')
    ? updateJsonInTree('.eslintrc', (json) => {
        json.rules ||= {};
        json.rules['@typescript-eslint/explicit-module-boundary-types'] = 'off';
        return json;
      })
    : noop();
};

export default function () {
  return chain([updatePackages, addLintRule, formatFiles()]);
}
