import { updateJsonFile } from '../../shared/fileutils';
import {
  devKitCoreVersion,
  devKitSchematicsVersion,
  schematicsAngularVersion
} from '../../shared/lib-versions';

export default {
  description: 'Add @angular-devkit/schematics as a dev dependency',
  run: () => {
    updateJsonFile('package.json', json => {
      json.devDependencies = {
        ...json.devDependencies,
        ['@angular-devkit/schematics']: devKitSchematicsVersion,
        ['@schematics/angular']: schematicsAngularVersion
      };
    });
  }
};
