import { updateJsonFile } from '../src/utils/fileutils';

export default {
  description: 'Add @angular-devkit/schematics as a dev dependency',
  run: () => {
    updateJsonFile('package.json', json => {
      json.devDependencies = {
        ...json.devDependencies,
        ['@angular-devkit/schematics']: '0.0.52',
        ['@schematics/angular']: '0.1.17'
      };
    });
  }
};
