import {
  addProjectConfiguration,
  formatFiles,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-zone-js-deep-import';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

describe('update-zone-js-deep-imports migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should replace replace import from "zone.js/dist/zone"', async () => {
    addProject(tree, 'app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/core',
    ]);
    tree.write(
      'apps/app1/src/polyfills.ts',
      `/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js/dist/zone'; // Included with Angular CLI.

/***************************************************************************************************
 * APPLICATION IMPORTS
 */
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/polyfills.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "/***************************************************************************************************
       * Zone JS is required by default for Angular itself.
       */
      import 'zone.js'; // Included with Angular CLI.

      /***************************************************************************************************
       * APPLICATION IMPORTS
       */
      "
    `);
    expect(formatFiles).toHaveBeenCalled();
  });

  it('should replace replace import from "zone.js/dist/zone-testing"', async () => {
    addProject(tree, 'app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/core',
    ]);
    tree.write(
      'apps/app1/src/test.ts',
      `// This file is required by karma.conf.js and loads recursively all the .spec and framework files
import 'zone.js/dist/zone';
import 'zone.js/dist/zone-testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

declare const require: any;

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/test.ts', 'utf-8')).toMatchInlineSnapshot(`
      "// This file is required by karma.conf.js and loads recursively all the .spec and framework files
      import 'zone.js';
      import 'zone.js/testing';
      import { getTestBed } from '@angular/core/testing';
      import {
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting,
      } from '@angular/platform-browser-dynamic/testing';

      declare const require: any;

      // First, initialize the Angular testing environment.
      getTestBed().initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting()
      );
      // Then we find all the tests.
      const context = require.context('./', true, /.spec.ts$/);
      // And load the modules.
      context.keys().map(context);
      "
    `);
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration,
  dependencies: string[]
): void {
  projectGraph = {
    dependencies: {
      [projectName]: dependencies.map((d) => ({
        source: projectName,
        target: d,
        type: 'static',
      })),
    },
    nodes: {
      [projectName]: { data: config, name: projectName, type: 'app' },
    },
  };
  addProjectConfiguration(tree, projectName, config);
}
