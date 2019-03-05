import { mergeWith, chain, url } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '../../utils/ast-utils';
import { jestVersion, nxVersion } from '../../lib-versions';
import { Rule } from '@angular-devkit/schematics';

const updatePackageJson = addDepsToPackageJson(
  {},
  {
    '@nrwl/builders': nxVersion,
    jest: jestVersion,
    '@types/jest': jestVersion
  }
);

export default function(): Rule {
  return chain([mergeWith(url('./files')), updatePackageJson]);
}
