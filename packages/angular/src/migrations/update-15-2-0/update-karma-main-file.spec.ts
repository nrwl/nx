import type { Tree } from '@nx/devkit';
import { addProjectConfiguration, stripIndents } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing-pre16';
import { Builders } from '@schematics/angular/utility/workspace-models';
import updateKarmaMainFile from './update-karma-main-file';

describe(`Migration to karma builder main file (test.ts)`, () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        test: {
          executor: Builders.Karma,
          options: {
            main: 'test.ts',
            karmaConfig: './karma.config.js',
            tsConfig: 'test-spec.json',
          },
          configurations: {
            production: {
              main: 'test-multiple-context.ts',
            },
          },
        },
      },
    });

    tree.write(
      'test.ts',
      stripIndents`
  import { getTestBed } from '@angular/core/testing';
  import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting
  } from '@angular/platform-browser-dynamic/testing';
  declare const require: {
    context(path: string, deep?: boolean, filter?: RegExp): {
      <T>(id: string): T;
      keys(): string[];
    };
  };
  // First, initialize the Angular testing environment.
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
  );
  // Then we find all the tests.
  const context = require.context('./', true, /\.spec\.ts$/);
  // And load the modules.
  context.keys().map(context);
  `
    );

    tree.write(
      'test-multiple-context.ts',
      stripIndents`
  import { getTestBed } from '@angular/core/testing';
  import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting
  } from '@angular/platform-browser-dynamic/testing';
  declare const require: {
    context(path: string, deep?: boolean, filter?: RegExp): {
      <T>(id: string): T;
      keys(): string[];
    };
  };
  // First, initialize the Angular testing environment.
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
  );
  // Then we find all the tests.
  const context1 = require.context('./', true, /\.spec\.ts$/);
  const context2 = require.context('./', true, /\.spec\.ts$/);
  // And load the modules.
  context2.keys().forEach(context2);
  context1.keys().map(context1);
  `
    );
  });

  it(`should remove 'declare const require' and 'require.context' usages`, async () => {
    await updateKarmaMainFile(tree);

    expect(tree.read('test.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { getTestBed } from '@angular/core/testing';
      import {
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting,
      } from '@angular/platform-browser-dynamic/testing';
      // First, initialize the Angular testing environment.
      getTestBed().initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting()
      );
      "
    `);
  });

  it(`should remove multiple 'require.context' usages`, async () => {
    await updateKarmaMainFile(tree);

    expect(tree.read('test-multiple-context.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { getTestBed } from '@angular/core/testing';
      import {
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting,
      } from '@angular/platform-browser-dynamic/testing';
      // First, initialize the Angular testing environment.
      getTestBed().initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting()
      );
      "
    `);
  });
});
