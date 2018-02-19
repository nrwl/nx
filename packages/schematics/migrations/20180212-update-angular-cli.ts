import { copyFile, updateJsonFile } from '../src/collection/utility/fileutils';
import * as path from 'path';

export default {
  description: 'Upgrade Angular CLI',
  run: () => {
    updateJsonFile('package.json', json => {

      json.devDependencies = {
        ...json.devDependencies,
        '@angular/cli': 'file:.angular_cli168.tgz',
      };
    });

    copyFile(
      path.join(__dirname, '..', 'src', 'collection', 'application', 'files', '__directory__', '.angular_cli168.tgz'),
      '.'
    );
  }
};
