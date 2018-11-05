import { Rule, externalSchematic, chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

export default function(): Rule {
  return chain([
    updateJsonInTree('package.json', json => {
      json.scripts = json.scripts || {};
      json.scripts = {
        ...json.scripts,
        affected: './node_modules/.bin/nx affected'
      };

      return json;
    })
  ]);
}
