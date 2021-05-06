import { Rule, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalized-schema';

export function updateLibPackageNpmScope(options: NormalizedSchema): Rule {
  return updateJsonInTree(`${options.projectRoot}/package.json`, (json) => {
    json.name = options.importPath;
    return json;
  });
}
