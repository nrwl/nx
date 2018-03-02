import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Add postinstall script to run nx-migrate:check',
  run: () => {
    updateJsonFile('package.json', json => {
      if (!json.scripts.postinstall) {
        json.scripts = {
          ...json.scripts,
          postinstall: './node_modules/.bin/nx migrate check'
        };
      }
    });
  }
};
