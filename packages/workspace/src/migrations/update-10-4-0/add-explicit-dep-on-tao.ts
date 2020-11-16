import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, addDepsToPackageJson } from '@nrwl/workspace';
import { nxVersion } from '../../../src/utils/versions';

export default function update(): Rule {
  return chain([
    addDepsToPackageJson({}, { '@nrwl/cli': nxVersion }),
    formatFiles(),
  ]);
}
