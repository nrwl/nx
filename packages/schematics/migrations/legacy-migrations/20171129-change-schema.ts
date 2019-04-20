import { updateJsonFile } from '@nrwl/workspace';

export default {
  description: 'Update the schema file to point to the nrwl schema.',
  run: () => {
    updateJsonFile('.angular-cli.json', json => {
      json['$schema'] = './node_modules/@nrwl/schematics/src/schema.json';
    });
  }
};
