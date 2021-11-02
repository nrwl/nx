import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../../utils/ast-utils';

export const addEnforceBuildablePackageTslintRule = (host: Tree) => {
  if (host.exists('tslint.json')) {
    return updateJsonInTree('tslint.json', (json) => {
      const ruleName = 'nx-enforce-module-boundaries';
      const rule = ruleName in json.rules ? json.rules[ruleName] : null;

      if (Array.isArray(rule) && typeof rule[1] === 'object') {
        // add flag
        rule[1].enforceBuildableLibDependency = true;
      }

      return json;
    });
  }
};

export const addEnforceBuildablePackageEslintRule = (host: Tree) => {
  if (host.exists('.eslintrc')) {
    return updateJsonInTree('.eslintrc', (json) => {
      const ruleName = '@nrwl/nx/enforce-module-boundaries';
      const rule = ruleName in json.rules ? json.rules[ruleName] : null;

      if (Array.isArray(rule) && typeof rule[1] === 'object') {
        // add flag
        rule[1].enforceBuildableLibDependency = true;
      }

      return json;
    });
  }
};

export default function (): Rule {
  return chain([
    addEnforceBuildablePackageTslintRule,
    addEnforceBuildablePackageEslintRule,
  ]);
}
