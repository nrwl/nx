import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';

import * as path from 'path';

describe('Update 6.4.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();
    initialTree.create(
      'package.json',
      serializeJson({
        dependencies: {
          '@angular/animations': '^6.1.0',
          '@angular/common': '^6.1.0',
          '@angular/compiler': '^6.1.0',
          '@angular/core': '^6.1.0',
          '@angular/forms': '^6.1.0',
          '@angular/platform-browser': '^6.1.0',
          '@angular/platform-browser-dynamic': '^6.1.0',
          '@angular/router': '^6.1.0',
          'core-js': '^2.5.4',
          rxjs: '^6.0.0',
          'zone.js': '^0.8.26',
          '@nrwl/nx': '6.1.0',
          '@ngrx/effects': '6.0.1',
          '@ngrx/store': '6.0.1',
          '@ngrx/router-store': '6.0.1'
        },
        devDependencies: {
          '@angular/cli': '6.1.2',
          '@angular/compiler-cli': '^6.1.0',
          '@angular/language-service': '^6.1.0',
          '@angular-devkit/build-angular': '~0.7.0',
          '@angular-devkit/build-ng-packagr': '~0.7.0',
          '@ngrx/store-devtools': '6.0.1',
          '@nrwl/schematics': '6.1.0',
          'jasmine-marbles': '0.3.1',
          '@types/jasmine': '~2.8.6',
          '@types/jasminewd2': '~2.0.3',
          '@types/node': '~8.9.4',
          codelyzer: '~4.2.1',
          'jasmine-core': '~2.99.1',
          'jasmine-spec-reporter': '~4.2.1',
          karma: '~2.0.0',
          'karma-chrome-launcher': '~2.2.0',
          'karma-coverage-istanbul-reporter': '~1.4.2',
          'karma-jasmine': '~1.1.0',
          'karma-jasmine-html-reporter': '^0.2.2',
          'ngrx-store-freeze': '0.2.4',
          protractor: '~5.3.0',
          'ts-node': '~5.0.1',
          tslint: '~5.9.1',
          typescript: '~2.7.2',
          prettier: '1.10.2'
        }
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should update dependencies', () => {
    const result = schematicRunner.runSchematic(
      'update-6.4.0',
      {},
      initialTree
    );

    expect(JSON.parse(result.readContent('package.json'))).toEqual({
      dependencies: {
        '@angular/animations': '^6.1.0',
        '@angular/common': '^6.1.0',
        '@angular/compiler': '^6.1.0',
        '@angular/core': '^6.1.0',
        '@angular/forms': '^6.1.0',
        '@angular/platform-browser': '^6.1.0',
        '@angular/platform-browser-dynamic': '^6.1.0',
        '@angular/router': '^6.1.0',
        'core-js': '^2.5.4',
        rxjs: '^6.0.0',
        'zone.js': '^0.8.26',
        '@nrwl/nx': '6.1.0',
        '@ngrx/effects': '6.1.0',
        '@ngrx/store': '6.1.0',
        '@ngrx/router-store': '6.1.0'
      },
      devDependencies: {
        '@angular/cli': '6.2.4',
        '@angular/compiler-cli': '^6.1.0',
        '@angular/language-service': '^6.1.0',
        '@angular-devkit/build-angular': '~0.8.0',
        '@angular-devkit/build-ng-packagr': '~0.8.0',
        '@ngrx/store-devtools': '6.1.0',
        '@nrwl/schematics': '6.1.0',
        'jasmine-marbles': '0.3.1',
        '@types/jasmine': '~2.8.6',
        '@types/jasminewd2': '~2.0.3',
        '@types/node': '~8.9.4',
        codelyzer: '~4.2.1',
        'jasmine-core': '~2.99.1',
        'jasmine-spec-reporter': '~4.2.1',
        karma: '~3.0.0',
        'karma-chrome-launcher': '~2.2.0',
        'karma-coverage-istanbul-reporter': '~2.0.1',
        'karma-jasmine': '~1.1.0',
        'karma-jasmine-html-reporter': '^0.2.2',
        'ngrx-store-freeze': '0.2.4',
        protractor: '~5.4.0',
        'ts-node': '~7.0.0',
        tslint: '~5.11.0',
        typescript: '~2.9.2',
        prettier: '1.10.2'
      }
    });
  });
});
