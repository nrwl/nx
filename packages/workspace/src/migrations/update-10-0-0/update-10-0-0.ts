import { chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../../utils/ast-utils';
import type { NxJsonConfiguration } from '@nrwl/devkit';
import { updatePackagesInPackageJson } from '../../utils/update-packages-in-package-json';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../..', 'migrations.json'),
  '10.0.0'
);

const addNxJsonAffectedConfig = updateJsonInTree(
  'nx.json',
  (json: NxJsonConfiguration) => {
    json.affected = {
      defaultBase: 'main',
    };

    return json;
  }
);

export default function () {
  return chain([updatePackages, addNxJsonAffectedConfig]);
}
