import { updateJsonFile } from '../src/utils/fileutils';

export default {
  description: 'Update script to use an updated way of invoking Nx commands',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'affected:apps': './node_modules/.bin/nx affected:apps',
        'affected:build': './node_modules/.bin/nx affected:build',
        'affected:e2e': './node_modules/.bin/nx affected:e2e',
        'affected:dep-graph': './node_modules/.bin/nx affected:dep-graph',
        format: './node_modules/.bin/nx format:write',
        'format:write': './node_modules/.bin/nx format:write',
        'format:check': './node_modules/.bin/nx format:check',
        update: './node_modules/.bin/nx update',
        'update:check': './node_modules/.bin/nx update:check',
        'update:skip': './node_modules/.bin/nx update:skip',
        'workspace-schematic': './node_modules/.bin/nx workspace-schematic',
        'dep-graph': './node_modules/.bin/nx dep-graph',
        help: './node_modules/.bin/nx help'
      };
    });
  }
};
