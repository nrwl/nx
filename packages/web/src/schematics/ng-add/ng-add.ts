import { Rule, chain } from '@angular-devkit/schematics';
import { updateJsonInTree, addPackageWithNgAdd } from '@nrwl/workspace';
import { addDepsToPackageJson } from '@nrwl/workspace';
import {
  nxVersion,
  documentRegisterElementVersion
} from '../../utils/versions';

function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      'document-register-element': documentRegisterElementVersion
    },
    {
      '@nrwl/web': nxVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/web'];
    return json;
  });
}

export default function() {
  return chain([
    addPackageWithNgAdd('@nrwl/jest'),
    addPackageWithNgAdd('@nrwl/cypress'),
    addDependencies(),
    moveDependency()
  ]);
}
