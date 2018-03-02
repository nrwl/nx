import { copyFile, updateJsonFile } from '../../shared/fileutils';
import * as path from 'path';

export default {
  description: 'Upgrade Angular and the CLI',
  run: () => {
    updateJsonFile('package.json', json => {
      json.dependencies = {
        ...json.dependencies,
        '@angular/animations': '^5.2.0',
        '@angular/common': '^5.2.0',
        '@angular/compiler': '^5.2.0',
        '@angular/core': '^5.2.0',
        '@angular/forms': '^5.2.0',
        '@angular/platform-browser': '^5.2.0',
        '@angular/platform-browser-dynamic': '^5.2.0',
        '@angular/router': '^5.2.0',
        'core-js': '^2.4.1',
        rxjs: '^5.5.6',
        'zone.js': '^0.8.19',
        '@ngrx/effects': '4.1.1',
        '@ngrx/router-store': '4.1.1',
        '@ngrx/store': '4.1.1'
      };

      json.devDependencies = {
        ...json.devDependencies,
        '@angular/cli': 'file:.angular_cli165.tgz',
        '@angular/compiler-cli': '^5.2.0',
        '@angular/language-service': '^5.2.0',
        'jasmine-core': '~2.8.0',
        'jasmine-spec-reporter': '~4.2.1',
        karma: '~2.0.0',
        'karma-chrome-launcher': '~2.2.0',
        'ts-node': '~4.1.0',
        tslint: '~5.9.1',
        typescript: '2.6.2'
      };
    });

    updateJsonFile('tslint.json', json => {
      json.rules['deprecation'] = { severity: 'warn' };
      json.rules['typeof-compare'] = undefined;
      json.rules['whitespace'] = undefined;
    });

    copyFile(
      path.join(__dirname, '..', 'src', 'collection', 'application', 'files', '__directory__', '.angular_cli165.tgz'),
      '.'
    );
  }
};
