import { updateJsonFile } from '../src/collection/utility/fileutils';
import { devKitCoreVersion } from '../src/collection/utility/lib-versions';

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
