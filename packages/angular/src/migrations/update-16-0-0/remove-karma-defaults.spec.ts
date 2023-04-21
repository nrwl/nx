import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeKarmaDefaults from './remove-karma-defaults';

describe('removeKarmaDefaults', () => {
  it('should remove karma as default unit test runner from nx.json when exists', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nrwl/angular:application': {
        unitTestRunner: 'karma',
      },
      '@nrwl/angular:library': {
        unitTestRunner: 'karma',
      },
      '@nrwl/angular:host': {
        unitTestRunner: 'karma',
      },
      '@nrwl/angular:remote': {
        unitTestRunner: 'karma',
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeKarmaDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@nrwl/angular:application": {},
        "@nrwl/angular:host": {},
        "@nrwl/angular:library": {},
        "@nrwl/angular:remote": {},
      }
    `);
  });

  it('should only remove karma as default unit test runner from nx.json when set', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nrwl/angular:application': {
        style: 'scss',
        unitTestRunner: 'karma',
      },
      '@nrwl/angular:library': {
        unitTestRunner: 'jest',
      },
      '@nrwl/angular:host': {
        style: 'scss',
        unitTestRunner: 'karma',
      },
      '@nrwl/angular:remote': {
        unitTestRunner: 'jest',
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeKarmaDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@nrwl/angular:application": {
          "style": "scss",
        },
        "@nrwl/angular:host": {
          "style": "scss",
        },
        "@nrwl/angular:library": {
          "unitTestRunner": "jest",
        },
        "@nrwl/angular:remote": {
          "unitTestRunner": "jest",
        },
      }
    `);
  });

  it('should not remove karma as default unit test runner from unsupported generator', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@my/custom:plugin': {
        style: 'scss',
        unitTestRunner: 'karma',
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeKarmaDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@my/custom:plugin": {
          "style": "scss",
          "unitTestRunner": "karma",
        },
      }
    `);
  });

  it('should remove karma as default for project specific generators', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test', {
      name: 'test',
      root: '.',
      sourceRoot: 'src',
      generators: {
        '@nrwl/angular:application': {
          style: 'scss',
          unitTestRunner: 'karma',
        },
      },
    });

    // ACT
    await removeKarmaDefaults(tree);

    // ASSERT
    expect(readProjectConfiguration(tree, 'test').generators)
      .toMatchInlineSnapshot(`
      {
        "@nrwl/angular:application": {
          "style": "scss",
        },
      }
    `);
  });

  it('should remove karma when using nested generator default syntax', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nrwl/angular:application': {
        style: 'scss',
        unitTestRunner: 'karma',
      },
      '@nrwl/angular:library': {
        unitTestRunner: 'jest',
      },
      '@nrwl/angular': {
        host: {
          style: 'scss',
          unitTestRunner: 'karma',
        },
        remote: {
          unitTestRunner: 'jest',
        },
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeKarmaDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@nrwl/angular": {
          "host": {
            "style": "scss",
          },
          "remote": {
            "unitTestRunner": "jest",
          },
        },
        "@nrwl/angular:application": {
          "style": "scss",
        },
        "@nrwl/angular:library": {
          "unitTestRunner": "jest",
        },
      }
    `);
  });
});
