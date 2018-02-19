import { updateJsonFile } from '../src/collection/utility/fileutils';
import {
  devKitCoreVersion,
  devKitSchematicsVersion,
  schematicsAngularVersion
} from '../src/collection/utility/lib-versions';

export default {
  description: 'Add @angular-devkit/core and schematics as a dev dependency',
  run: () => {
    updateJsonFile('package.json', json => {
      json.devDependencies = {
        ...json.devDependencies,
        ['@angular-devkit/core']: devKitCoreVersion,
        ['@angular-devkit/schematics']: devKitSchematicsVersion,
        ['@schematics/angular']: schematicsAngularVersion
      };
    });
  }
};
