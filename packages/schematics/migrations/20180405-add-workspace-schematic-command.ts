import { updateJsonFile } from '@nrwl/schematics/src/utils/fileutils';

export default {
  description: 'Add a command to generate workspace-specific schematics',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        'workspace-schematic': './node_modules/.bin/nx workspace-schematic'
      };
    });
  }
};
