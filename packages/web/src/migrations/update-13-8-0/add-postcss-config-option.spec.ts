import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import migrate from './add-postcss-config-option';

describe('Migration: add PostCSS config option', () => {
  it(`should add postcssConfig option if file exists`, async () => {
    let tree = createTreeWithEmptyWorkspace();

    tree.write(
      'workspace.json',
      JSON.stringify({
        version: 2,
        projects: {
          myapp: {
            root: 'apps/myapp',
            sourceRoot: 'apps/myapp/src',
            projectType: 'application',
            targets: {
              build: {
                executor: '@nrwl/web:webpack',
                options: {},
              },
            },
          },
        },
      })
    );
    tree.write('apps/myapp/postcss.config.js', `module.exports = {};`);

    await migrate(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
          sourceRoot: 'apps/myapp/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nrwl/web:webpack',
              options: {
                postcssConfig: 'apps/myapp/postcss.config.js',
              },
            },
          },
        },
      },
    });
  });
  it(`should not add postcssConfig option if file does not exist`, async () => {
    let tree = createTreeWithEmptyWorkspace();

    tree.write(
      'workspace.json',
      JSON.stringify({
        version: 2,
        projects: {
          myapp: {
            root: 'apps/myapp',
            sourceRoot: 'apps/myapp/src',
            projectType: 'application',
            targets: {
              build: {
                executor: '@nrwl/web:webpack',
                options: {},
              },
            },
          },
        },
      })
    );

    await migrate(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
          sourceRoot: 'apps/myapp/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nrwl/web:webpack',
              options: {},
            },
          },
        },
      },
    });
  });
});
