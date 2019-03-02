import { chain, Rule } from '@angular-devkit/schematics';

import { updateJsonInTree } from '../../src/utils/ast-utils';
import { formatFiles } from '../../src/utils/rules/format-files';
import { Framework } from '../../src/utils/frameworks';

const setDefaults = updateJsonInTree('angular.json', json => {
  if (!json.schematics) {
    json.schematics = {};
  }
  if (!json.schematics['@nrwl/schematics:library']) {
    json.schematics['@nrwl/schematics:library'] = {};
  }
  if (!json.schematics['@nrwl/schematics:library'].framework) {
    json.schematics['@nrwl/schematics:library'].framework = Framework.Angular;
  }
  return json;
});

export default function(): Rule {
  return chain([setDefaults, formatFiles()]);
}
