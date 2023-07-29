import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeProtractorDefaults from './remove-protractor-defaults';

describe('removeProtractorDefaults', () => {
  it('should remove protractor as default unit test runner from nx.json when exists', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nrwl/angular:application': {
        e2eTestRunner: 'protractor',
      },
      '@nrwl/angular:host': {
        e2eTestRunner: 'protractor',
      },
      '@nrwl/angular:remote': {
        e2eTestRunner: 'protractor',
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeProtractorDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@nrwl/angular:application": {},
        "@nrwl/angular:host": {},
        "@nrwl/angular:remote": {},
      }
    `);
  });

  it('should only remove protractor as default unit test runner from nx.json when set', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nrwl/angular:application': {
        style: 'scss',
        e2eTestRunner: 'protractor',
      },
      '@nrwl/angular:host': {
        style: 'scss',
        e2eTestRunner: 'protractor',
      },
      '@nrwl/angular:remote': {
        e2eTestRunner: 'cypress',
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeProtractorDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@nrwl/angular:application": {
          "style": "scss",
        },
        "@nrwl/angular:host": {
          "style": "scss",
        },
        "@nrwl/angular:remote": {
          "e2eTestRunner": "cypress",
        },
      }
    `);
  });

  it('should not remove protractor as default e2e test runner from unsupported generator', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@my/custom:plugin': {
        style: 'scss',
        e2eTestRunner: 'protractor',
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeProtractorDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@my/custom:plugin": {
          "e2eTestRunner": "protractor",
          "style": "scss",
        },
      }
    `);
  });

  it('should remove protractor as default for project specific generators', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test', {
      name: 'test',
      root: '.',
      sourceRoot: 'src',
      generators: {
        '@nrwl/angular:application': {
          style: 'scss',
          e2eTestRunner: 'protractor',
        },
      },
    });

    // ACT
    await removeProtractorDefaults(tree);

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

  it('should remove protractor when using nested generator default syntax', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nrwl/angular:application': {
        style: 'scss',
        e2eTestRunner: 'protractor',
      },
      '@nrwl/angular': {
        host: {
          style: 'scss',
          e2eTestRunner: 'protractor',
        },
        remote: {
          e2eTestRunner: 'cypress',
        },
      },
    };
    updateNxJson(tree, nxJson);

    // ACT
    await removeProtractorDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).generators).toMatchInlineSnapshot(`
      {
        "@nrwl/angular": {
          "host": {
            "style": "scss",
          },
          "remote": {
            "e2eTestRunner": "cypress",
          },
        },
        "@nrwl/angular:application": {
          "style": "scss",
        },
      }
    `);
  });
});
