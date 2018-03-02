import {updateJsonFile} from '../../shared/fileutils';

export default {
  description: 'Add update, update:skip, update:check scripts',
  run: () => {
    updateJsonFile('package.json', json => {
      json.scripts = {
        ...json.scripts,
        "update": "./node_modules/.bin/nx update",
        "update:check": "./node_modules/.bin/nx update check",
        "update:skip": "./node_modules/.bin/nx update skip",
        "nx-migrate": undefined,
        "nx-migrate:check": undefined,
        "nx-migrate:skip": undefined,
        "apps:affected": undefined,
        "build:affected": undefined,
        "e2e:affected": undefined
      };

      if (json.scripts.postinstall === './node_modules/.bin/nx migrate check') {
        json.scripts.postinstall = "./node_modules/.bin/nx postinstall";
      }
    });
  }
};
