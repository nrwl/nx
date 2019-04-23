import {
  Rule,
  chain,
  externalSchematic,
  noop,
  Tree
} from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree,
  readJsonInTree,
  addPackageWithNgAdd
} from '@nrwl/workspace';
import {
  frameworkVersion,
  typesVersion,
  domTypesVersion,
  testingLibraryVersion,
  nxVersion
} from '../../utils/versions';

export function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      react: frameworkVersion,
      'react-dom': frameworkVersion
    },
    {
      '@nrwl/react': nxVersion,
      '@types/react': typesVersion,
      '@types/react-dom': domTypesVersion,
      'react-testing-library': testingLibraryVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/react'];
    return json;
  });
}

export default function() {
  return chain([
    addPackageWithNgAdd('@nrwl/jest'),
    addPackageWithNgAdd('@nrwl/cypress'),
    addPackageWithNgAdd('@nrwl/web'),
    addDependencies(),
    moveDependency()
  ]);
}
