import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './set-generator-defaults-for-previous-style-guide';

describe('set-generator-defaults-for-previous-style-guide', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add the generator defaults when there is no generators property in the nx.json file', async () => {
    const nxJson = readNxJson(tree);
    delete nxJson.generators;
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updatedNxJson = readNxJson(tree);
    expect(updatedNxJson.generators).toMatchInlineSnapshot(`
      {
        "@nx/angular:component": {
          "type": "component",
        },
        "@nx/angular:directive": {
          "type": "directive",
        },
        "@nx/angular:guard": {
          "typeSeparator": ".",
        },
        "@nx/angular:interceptor": {
          "typeSeparator": ".",
        },
        "@nx/angular:module": {
          "typeSeparator": ".",
        },
        "@nx/angular:pipe": {
          "typeSeparator": ".",
        },
        "@nx/angular:resolver": {
          "typeSeparator": ".",
        },
        "@nx/angular:scam": {
          "type": "component",
        },
        "@nx/angular:scam-directive": {
          "type": "directive",
        },
        "@nx/angular:service": {
          "type": "service",
        },
        "@schematics/angular:component": {
          "type": "component",
        },
        "@schematics/angular:directive": {
          "type": "directive",
        },
        "@schematics/angular:guard": {
          "typeSeparator": ".",
        },
        "@schematics/angular:interceptor": {
          "typeSeparator": ".",
        },
        "@schematics/angular:module": {
          "typeSeparator": ".",
        },
        "@schematics/angular:pipe": {
          "typeSeparator": ".",
        },
        "@schematics/angular:resolver": {
          "typeSeparator": ".",
        },
        "@schematics/angular:service": {
          "type": "service",
        },
      }
    `);
  });

  it('should add the generator defaults when there is an empty generators property in the nx.json file', async () => {
    const nxJson = readNxJson(tree);
    nxJson.generators = {};
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updatedNxJson = readNxJson(tree);
    expect(updatedNxJson.generators).toMatchInlineSnapshot(`
      {
        "@nx/angular:component": {
          "type": "component",
        },
        "@nx/angular:directive": {
          "type": "directive",
        },
        "@nx/angular:guard": {
          "typeSeparator": ".",
        },
        "@nx/angular:interceptor": {
          "typeSeparator": ".",
        },
        "@nx/angular:module": {
          "typeSeparator": ".",
        },
        "@nx/angular:pipe": {
          "typeSeparator": ".",
        },
        "@nx/angular:resolver": {
          "typeSeparator": ".",
        },
        "@nx/angular:scam": {
          "type": "component",
        },
        "@nx/angular:scam-directive": {
          "type": "directive",
        },
        "@nx/angular:service": {
          "type": "service",
        },
        "@schematics/angular:component": {
          "type": "component",
        },
        "@schematics/angular:directive": {
          "type": "directive",
        },
        "@schematics/angular:guard": {
          "typeSeparator": ".",
        },
        "@schematics/angular:interceptor": {
          "typeSeparator": ".",
        },
        "@schematics/angular:module": {
          "typeSeparator": ".",
        },
        "@schematics/angular:pipe": {
          "typeSeparator": ".",
        },
        "@schematics/angular:resolver": {
          "typeSeparator": ".",
        },
        "@schematics/angular:service": {
          "type": "service",
        },
      }
    `);
  });

  it('should not override existing generator defaults for the full generator specifier (<collection>:<generator>) ', async () => {
    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nx/angular:component': { type: 'cmp' },
      '@schematics/angular:component': { type: 'cmp' },
      '@nx/angular:interceptor': { typeSeparator: '-' },
      '@schematics/angular:interceptor': { typeSeparator: '-' },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updatedNxJson = readNxJson(tree);
    expect(updatedNxJson.generators).toMatchInlineSnapshot(`
      {
        "@nx/angular:component": {
          "type": "cmp",
        },
        "@nx/angular:directive": {
          "type": "directive",
        },
        "@nx/angular:guard": {
          "typeSeparator": ".",
        },
        "@nx/angular:interceptor": {
          "typeSeparator": "-",
        },
        "@nx/angular:module": {
          "typeSeparator": ".",
        },
        "@nx/angular:pipe": {
          "typeSeparator": ".",
        },
        "@nx/angular:resolver": {
          "typeSeparator": ".",
        },
        "@nx/angular:scam": {
          "type": "component",
        },
        "@nx/angular:scam-directive": {
          "type": "directive",
        },
        "@nx/angular:service": {
          "type": "service",
        },
        "@schematics/angular:component": {
          "type": "cmp",
        },
        "@schematics/angular:directive": {
          "type": "directive",
        },
        "@schematics/angular:guard": {
          "typeSeparator": ".",
        },
        "@schematics/angular:interceptor": {
          "typeSeparator": "-",
        },
        "@schematics/angular:module": {
          "typeSeparator": ".",
        },
        "@schematics/angular:pipe": {
          "typeSeparator": ".",
        },
        "@schematics/angular:resolver": {
          "typeSeparator": ".",
        },
        "@schematics/angular:service": {
          "type": "service",
        },
      }
    `);
  });

  it('should not override existing generator defaults for nested generator specifiers (<collection>.<generator>)', async () => {
    const nxJson = readNxJson(tree);
    nxJson.generators = {
      '@nx/angular': {
        component: { type: 'cmp' },
        interceptor: { typeSeparator: '-' },
      },
      '@schematics/angular': {
        component: { type: 'cmp' },
        interceptor: { typeSeparator: '-' },
      },
    };
    updateNxJson(tree, nxJson);

    await migration(tree);

    const updatedNxJson = readNxJson(tree);
    expect(updatedNxJson.generators).toMatchInlineSnapshot(`
      {
        "@nx/angular": {
          "component": {
            "type": "cmp",
          },
          "directive": {
            "type": "directive",
          },
          "guard": {
            "typeSeparator": ".",
          },
          "interceptor": {
            "typeSeparator": "-",
          },
          "module": {
            "typeSeparator": ".",
          },
          "pipe": {
            "typeSeparator": ".",
          },
          "resolver": {
            "typeSeparator": ".",
          },
          "scam": {
            "type": "component",
          },
          "scam-directive": {
            "type": "directive",
          },
          "service": {
            "type": "service",
          },
        },
        "@schematics/angular": {
          "component": {
            "type": "cmp",
          },
          "directive": {
            "type": "directive",
          },
          "guard": {
            "typeSeparator": ".",
          },
          "interceptor": {
            "typeSeparator": "-",
          },
          "module": {
            "typeSeparator": ".",
          },
          "pipe": {
            "typeSeparator": ".",
          },
          "resolver": {
            "typeSeparator": ".",
          },
          "service": {
            "type": "service",
          },
        },
      }
    `);
  });
});
