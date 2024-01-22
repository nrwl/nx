import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addTestSetupToIgnoredInputs from './add-test-setup-to-inputs-ignore';

describe('Jest Migration - jest 29 mocked usage in tests', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add inputs configuration for test-setup if missing', async () => {
    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });

    await addTestSetupToIgnoredInputs(tree);

    const updated = readNxJson(tree);
    expect(updated.namedInputs.production).toMatchInlineSnapshot(`
      [
        "default",
        "!{projectRoot}/src/test-setup.[jt]s",
      ]
    `);
  });

  it('should not add inputs configuration for test-setup if existing', async () => {
    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['!{projectRoot}/src/test-setup.[jt]s', 'default'],
      },
    });

    await addTestSetupToIgnoredInputs(tree);

    const updated = readNxJson(tree);
    expect(updated.namedInputs.production).toMatchInlineSnapshot(`
      [
        "!{projectRoot}/src/test-setup.[jt]s",
        "default",
      ]
    `);
  });
});
