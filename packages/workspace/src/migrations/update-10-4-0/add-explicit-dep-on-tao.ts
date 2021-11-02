import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles } from '../../utils/rules/format-files';
import { nxVersion } from '../../utils/versions';
import { sortObjectByKeys, updateJsonInTree } from '../../utils/ast-utils';

export default function update(): Rule {
  return chain([
    updateJsonInTree('package.json', (json) => {
      json.dependencies = json.dependencies || {};

      json.devDependencies = json.devDependencies || {};

      delete json.dependencies['@nrwl/cli'];
      json.devDependencies['@nrwl/cli'] = nxVersion;
      delete json.dependencies['@nrwl/tao'];
      json.devDependencies['@nrwl/tao'] = nxVersion;

      json.dependencies = sortObjectByKeys(json.dependencies);
      json.devDependencies = sortObjectByKeys(json.devDependencies);

      return json;
    }),
    formatFiles(),
  ]);
}
