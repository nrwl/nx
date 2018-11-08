import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree } from '@angular-devkit/schematics';

describe('app', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let projectTree: Tree;

  beforeEach(() => {
    projectTree = Tree.empty();
  });

  it('should update angular.json', () => {
    const tree = schematicRunner.runSchematic(
      'ng-new',
      { name: 'proj' },
      projectTree
    );
  });

  it('should create files', () => {
    const tree = schematicRunner.runSchematic(
      'ng-new',
      { name: 'proj' },
      projectTree
    );
    expect(tree.exists('/proj/nx.json')).toBe(true);
    expect(tree.exists('/proj/angular.json')).toBe(true);
    expect(tree.exists('/proj/.prettierrc')).toBe(true);
    expect(tree.exists('/proj/.prettierignore')).toBe(true);
    expect(tree.exists('/proj/karma.conf.js')).toBe(true);
  });

  it('should create a root karma configuration', () => {
    const tree = schematicRunner.runSchematic(
      'ng-new',
      { name: 'proj' },
      projectTree
    );
    expect(tree.readContent('/proj/karma.conf.js')).toBe(
      `// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

const { join } = require('path');
const { constants } = require('karma');

module.exports = () => {
  return {
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    coverageIstanbulReporter: {
      dir: join(__dirname, '../../coverage'),
      reports: ['html', 'lcovonly'],
      fixWebpackSourcePaths: true
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: constants.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: true
  };
};
`
    );
  });

  it('should not set package manager by default', () => {
    const treeNoPackages = schematicRunner.runSchematic(
      'ng-new',
      { name: 'proj' },
      projectTree
    );
    expect(
      JSON.parse(treeNoPackages.readContent('/proj/angular.json')).cli
        .packageManager
    ).toBeUndefined();
  });

  it('should set package manager when provided', () => {
    const tree = schematicRunner.runSchematic(
      'ng-new',
      { name: 'proj', packageManager: 'yarn' },
      projectTree
    );
    expect(
      JSON.parse(tree.readContent('/proj/angular.json')).cli.packageManager
    ).toEqual('yarn');
  });
});
