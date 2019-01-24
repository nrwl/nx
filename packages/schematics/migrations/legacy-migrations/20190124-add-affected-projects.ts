import { updateJsonFile } from '../../src/utils/fileutils';

export default {
  description: 'Added affected:projects npm script',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'affected:projects': './node_modules/.bin/nx affected:projects'
      };
    });
  }
};
