import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Add nx-migrate:check and nx-migrate:skip to npm scripts',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,

        'nx-migrate': './node_modules/.bin/nx migrate',
        'nx-migrate:check': './node_modules/.bin/nx migrate check',
        'nx-migrate:skip': './node_modules/.bin/nx migrate skip'
      };
    });
  }
};
