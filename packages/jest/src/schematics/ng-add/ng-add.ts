import { mergeWith, chain, url } from '@angular-devkit/schematics';
import { addDepsToPackageJson, updateJsonInTree } from '@nrwl/workspace';
import {
  jestVersion,
  jestTypesVersion,
  tsJestVersion,
  nxVersion
} from '../../utils/versions';
import { Rule } from '@angular-devkit/schematics';

const updatePackageJson = chain([
  addDepsToPackageJson(
    {},
    {
      '@nrwl/jest': nxVersion,
      jest: jestVersion,
      '@types/jest': jestTypesVersion,
      'ts-jest': tsJestVersion
    }
  ),
  updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};
    delete json.dependencies['@nrwl/jest'];
    return json;
  })
]);

export default function(): Rule {
  return chain([mergeWith(url('./files')), updatePackageJson]);
}
