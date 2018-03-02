import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Update package.json to include apps:affected, build:affected, e2e:affected',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'apps:affected': 'node ./node_modules/@nrwl/schematics/src/affected/run-affected.js apps',
        'build:affected': 'node ./node_modules/@nrwl/schematics/src/affected/run-affected.js build',
        'e2e:affected': 'node ./node_modules/@nrwl/schematics/src/affected/run-affected.js e2e'
      };
    });
  }
};
