import { updateJsonFile } from '../src/utils/fileutils';

export default {
  description: 'Update npm scripts to use the nx command',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'dep-graph': './node_modules/.bin/nx dep-graph',
        'affected:dep-graph':
          'node ./node_modules/@nrwl/schematics/src/command-line/affected.js dep-graph'
      };
    });
  }
};
