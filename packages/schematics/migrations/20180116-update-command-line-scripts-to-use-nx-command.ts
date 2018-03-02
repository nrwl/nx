import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Update npm scripts to use the nx command',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,

        'apps:affected': './node_modules/.bin/nx affected apps',
        'build:affected': './node_modules/.bin/nx affected build',
        'e2e:affected': './node_modules/.bin/nx affected e2e',

        'affected:apps': './node_modules/.bin/nx affected apps',
        'affected:build': './node_modules/.bin/nx affected build',
        'affected:e2e': './node_modules/.bin/nx affected e2e',

        format: './node_modules/.bin/nx format write',
        'format:write': './node_modules/.bin/nx format write',
        'format:check': './node_modules/.bin/nx format check',

        'nx-migrate': './node_modules/.bin/nx migrate'
      };
    });
  }
};
