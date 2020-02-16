import { chain } from '@angular-devkit/schematics';
import { join } from 'path';
import { updateNxJsonDefaultBranch } from '../../utils/update-default-branch-in-nx-json';

const updatePackages = updateNxJsonDefaultBranch(
  join(__dirname, '../../../', 'migrations.json'),
  '10.0.0'
);

export default function() {
  return chain([updatePackages]);
}
