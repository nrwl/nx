import { updateJsonFile } from '../../src/utils/fileutils';

export default {
  description: 'Run lint checks ensuring the integrity of the workspace',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        lint: './node_modules/.bin/nx lint && ng lint'
      };
    });
  }
};
