import { updateJsonFile } from '@nrwl/workspace';

export default {
  description: 'Update npm scripts to use the nx command',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'dep-graph': './node_modules/.bin/nx dep-graph',
        'affected:dep-graph': './node_modules/.bin/nx affected dep-graph'
      };
    });
  }
};
