import { chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../../utils/ast-utils';
import { NxJson } from '../../core/shared-interfaces';
import { updatePackagesInPackageJson } from '../../utils/update-packages-in-package-json';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../..', 'migrations.json'),
  '10.0.0'
);

const addNxJsonAffectedConfig = updateJsonInTree('nx.json', (json: NxJson) => {
  json.affected = {
    defaultBase: 'master',
  };

  return json;
});

export default function () {
  return chain([updatePackages, addNxJsonAffectedConfig]);
}
