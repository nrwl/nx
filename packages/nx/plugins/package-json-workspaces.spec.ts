import * as memfs from 'memfs';

import '../src/utils/testing/mock-fs';
import { getNxPackageJsonWorkspacesPlugin } from './package-json-workspaces';

describe('nx package.json workspaces plugin', () => {
  it('should build projects from package.json files', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'root',
          scripts: { echo: 'echo root project' },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    const plugin = getNxPackageJsonWorkspacesPlugin('/root');

    // Targets from package.json files are handled outside of `createNodes`,
    // because they are recognized even if the package.json file is not included
    // in the package manager workspaces configuration.
    //
    // If any project has a package.json file in its root directory, those scripts
    // are targets regardless of this plugin. As such, all we have to do here is identify
    // that the package.json represents an Nx project, and `normalizeProjectNodes`
    // will handle the rest.
    expect(plugin.createNodes[1]('package.json', null)).toMatchInlineSnapshot(`
      {
        "projects": {
          "root": {
            "name": "root",
            "projectType": "library",
            "root": ".",
            "sourceRoot": ".",
          },
        },
      }
    `);
    expect(plugin.createNodes[1]('packages/lib-a/package.json', null))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "lib-a": {
            "name": "lib-a",
            "projectType": "library",
            "root": "packages/lib-a",
            "sourceRoot": "packages/lib-a",
          },
        },
      }
    `);
  });
});
