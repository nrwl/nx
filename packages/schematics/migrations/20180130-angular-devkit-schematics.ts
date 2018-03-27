import { updateJsonFile } from '../src/utils/fileutils';
import {
  devKitSchematicsVersion,
  schematicsAngularVersion
} from '../src/lib-versions';

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
