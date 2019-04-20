import {
  Rule,
  chain,
  externalSchematic,
  noop,
  Tree
} from '@angular-devkit/schematics';
import { updateJsonInTree, readJsonInTree } from '@nrwl/workspace';
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

function addCypress(): Rule {
  return (host: Tree) => {
    const packageJson = readJsonInTree(host, 'package.json');
    return !packageJson.devDependencies['@nrwl/cypress']
      ? externalSchematic(
          '@nrwl/cypress',
          'ng-add',
          {},
          {
            interactive: false
          }
        )
      : noop();
  };
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/web'];
    return json;
  });
}

export default function() {
  return chain([addJest(), addCypress(), addDependencies(), moveDependency()]);
}
