import {
  Rule,
  chain,
  externalSchematic,
  Tree,
  noop
} from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree,
  readJsonInTree,
  addPackageWithNgAdd
} from '@nrwl/workspace';
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
  return chain([
    addPackageWithNgAdd('@nrwl/node'),
    addPackageWithNgAdd('@nrwl/jest'),
    addDependencies(),
    moveDependency()
  ]);
}
