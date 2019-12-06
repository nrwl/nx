import { updatePackagesInPackageJson } from '@nrwl/workspace';

import { join } from 'path';

export default () => {
  return updatePackagesInPackageJson(
    join(__dirname, '../../../migrations.json'),
    '9.0.0'
  );
};
