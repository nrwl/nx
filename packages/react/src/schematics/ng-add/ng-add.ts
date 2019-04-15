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
  readJsonInTree
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

function addJest(): Rule {
  return (host: Tree) => {
    const packageJson = readJsonInTree(host, 'package.json');
    return !packageJson.devDependencies['@nrwl/jest']
      ? externalSchematic(
          '@nrwl/jest',
          'ng-add',
          {},
          {
            interactive: false
          }
        )
      : noop();
  };
}

export default function() {
  return chain([addJest(), addDependencies(), moveDependency()]);
}
