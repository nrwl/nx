import { updateJsonFile } from '../../shared/fileutils';
import { devKitCoreVersion } from '../../shared/lib-versions';

export default {
  description: 'Add @angular-devkit/core as a dev dependency',
  run: () => {
    updateJsonFile('package.json', json => {
      json.devDependencies = {
        ...json.devDependencies,
        ['@angular-devkit/core']: devKitCoreVersion
      };
    });
  }
};
