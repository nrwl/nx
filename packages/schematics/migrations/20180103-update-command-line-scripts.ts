import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Add format:write and format:check to npm scripts',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'apps:affected': 'node ./node_modules/@nrwl/schematics/src/command-line/affected.js apps',
        'build:affected': 'node ./node_modules/@nrwl/schematics/src/command-line/affected.js build',
        'e2e:affected': 'node ./node_modules/@nrwl/schematics/src/command-line/affected.js e2e',

        'affected:apps': 'node ./node_modules/@nrwl/schematics/src/command-line/affected.js apps',
        'affected:build': 'node ./node_modules/@nrwl/schematics/src/command-line/affected.js build',
        'affected:e2e': 'node ./node_modules/@nrwl/schematics/src/command-line/affected.js e2e',

        format: 'node ./node_modules/@nrwl/schematics/src/command-line/format.js write',
        'format:write': 'node ./node_modules/@nrwl/schematics/src/command-line/format.js write',
        'format:check': 'node ./node_modules/@nrwl/schematics/src/command-line/format.js check',

        'nx-migrate': 'node ./node_modules/@nrwl/schematics/src/command-line/nx-migrate.js'
      };
    });
  }
};
