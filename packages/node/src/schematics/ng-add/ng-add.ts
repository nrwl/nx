import { Rule, chain } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree
} from '@nrwl/schematics/src/utils/ast-utils';
import { nxVersion } from '../../utils/versions';

function addDependencies(): Rule {
  return addDepsToPackageJson(
    {},
    {
      '@nrwl/node': nxVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/node'];
    return json;
  });
}

export default function() {
  return chain([addDependencies(), moveDependency()]);
}
