import { Rule, chain } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree
} from '@nrwl/schematics/src/utils/ast-utils';
import {
  frameworkVersion,
  typesVersion,
  domTypesVersion,
  testingLibraryVersion,
  nxVersion
} from '../../utils/versions';

function addDependencies(): Rule {
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
  return chain([addDependencies(), moveDependency()]);
}
