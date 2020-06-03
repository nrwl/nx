import { Rule, Tree } from '@angular-devkit/schematics';
import { getNpmScope, updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalized-schema';

export function updateLibPackageNpmScope(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return updateJsonInTree(`${options.projectRoot}/package.json`, (json) => {
      json.name = `@${getNpmScope(host)}/${options.name}`;
      return json;
    });
  };
}
