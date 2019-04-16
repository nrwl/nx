import { Rule, chain, externalSchematic } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree
} from '@nrwl/schematics/src/utils/ast-utils';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion
} from '../../utils/versions';

function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      express: expressVersion
    },
    {
      '@types/express': expressTypingsVersion,
      '@nrwl/express': nxVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/express'];
    return json;
  });
}

export default function() {
  return chain([externalSchematic('@nrwl/node', 'ng-add', {}), addDependencies(), moveDependency()]);
}
