import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../ast-utils';

export function removeDependency(dependency: string): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies[dependency];
    return json;
  });
}
