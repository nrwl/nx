import { updateJsonFile } from '@nrwl/workspace';

export default {
  description: 'Add tags to all app and libs',
  run: async () => {
    updateJsonFile('.angular-cli.json', json => {
      json.apps = json.apps.map(app => ({ ...app, tags: [] }));
    });

    updateJsonFile('tslint.json', json => {
      if (json.rules['nx-enforce-module-boundaries']) {
        json.rules['nx-enforce-module-boundaries'][1].depConstraints = [
          { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }
        ];
        json.rules['nx-enforce-module-boundaries'][1].lazyLoad = undefined;
      }
    });
  }
};
