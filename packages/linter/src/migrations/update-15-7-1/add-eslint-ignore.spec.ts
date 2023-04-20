import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addEslintIgnore from './add-eslint-ignore';

describe('15.7.1 migration (add-eslintignore)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
      },
    });

    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        lint: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        lint2: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
  });

  it('should not add .eslintignore if eslint config does not exist', async () => {
    await addEslintIgnore(tree);
    expect(tree.exists('.eslintignore')).toBeFalsy();
  });

  it('should add .eslintignore if it does not exist', async () => {
    ensureGlobalConfig(tree);

    await addEslintIgnore(tree);

    expect(tree.exists('.eslintignore')).toBeTruthy();
    expect(tree.read('.eslintignore', 'utf-8')).toEqual('node_modules\n');
  });

  it('should add node_modules if missing in .eslintignore', async () => {
    ensureGlobalConfig(tree);

    const original = 'dist\ntmp\n';
    tree.write('.eslintignore', original);

    await addEslintIgnore(tree);

    expect(tree.read('.eslintignore', 'utf-8')).toEqual(
      `node_modules\n${original}`
    );
  });

  it('should not add node_modules if already in .eslintignore', async () => {
    ensureGlobalConfig(tree);

    const original = `dist\nnode_modules\ntmp\n`;
    tree.write('.eslintignore', original);

    await addEslintIgnore(tree);

    expect(tree.read('.eslintignore', 'utf-8')).toEqual(original);
  });

  it('should add lint target', async () => {
    ensureGlobalConfig(tree);

    await addEslintIgnore(tree);

    expect(tree.exists('.eslintignore')).toBeTruthy();
    expect(readJson(tree, 'nx.json').targetDefaults).toMatchInlineSnapshot(`
      {
        "lint": {
          "inputs": [
            "default",
            "{workspaceRoot}/.eslintrc.json",
          ],
        },
        "lint2": {
          "inputs": [
            "default",
            "{workspaceRoot}/.eslintrc.json",
          ],
        },
      }
    `);
  });
});

function ensureGlobalConfig(tree: Tree) {
  tree.write('.eslintrc.json', '{}');
}
