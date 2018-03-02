import { updateJsonFile } from '../../shared/fileutils';
import { unlinkSync } from 'fs';

export default {
  description: 'Switch to Angular CLI 1.7',
  run: () => {
    updateJsonFile('package.json', json => {
      json.devDependencies = {
        ...json.devDependencies,
        "@angular/cli": "1.7.1",
        "@angular/compiler-cli": "5.2.7",
        "@angular/language-service": "5.2.7",
        "@types/jasmine": "~2.5.53",
        ['@angular-devkit/core']: undefined,
        ['@angular-devkit/schematics']: undefined,
        ['@schematics/angular']: undefined,
        ['karma-cli']: undefined
      };

      json.dependencies = {
        ...json.dependencies,
        "@angular/animations": "5.2.7",
        "@angular/common": "5.2.7",
        "@angular/compiler": "5.2.7",
        "@angular/core": "5.2.7",
        "@angular/forms": "5.2.7",
        "@angular/platform-browser": "5.2.7",
        "@angular/platform-browser-dynamic": "5.2.7",
        "@angular/router": "5.2.7",
        "@ngrx/effects": "5.1.0",
        "@ngrx/router-store": "5.0.1",
        "@ngrx/store": "5.1.0",
        "@ngrx/store-devtools": "5.1.0"
      };

      if (json.dependencies['@angular/http']) {
        json.dependencies['@angular/http'] = '5.2.7';
      }
    });

    try {
      unlinkSync('.angular_cli165.tgz');
    } catch (e) {}
  }
};
