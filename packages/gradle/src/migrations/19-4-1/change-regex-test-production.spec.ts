import { Tree, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-regex-test-production';

describe('change-regex-test-production', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add the namedInputs production if it does not exist', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({ namedInputs: {}, plugins: ['@nx/gradle'] })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
          ],
          "production": [
            "default",
            "!{projectRoot}/src/test/**/*",
          ],
        },
        "plugins": [
          "@nx/gradle",
        ],
      }
    `);
  });

  it('should add the namedInputs production if it is empty', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        namedInputs: { production: [] },
        plugins: ['@nx/gradle'],
      })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
          ],
          "production": [
            "default",
            "!{projectRoot}/src/test/**/*",
          ],
        },
        "plugins": [
          "@nx/gradle",
        ],
      }
    `);
  });

  it('should remove !{projectRoot}/test/**/* from the namedInputs production', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        namedInputs: { production: ['!{projectRoot}/test/**/*'] },
        plugins: ['@nx/gradle'],
      })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
          ],
          "production": [
            "default",
            "!{projectRoot}/src/test/**/*",
          ],
        },
        "plugins": [
          "@nx/gradle",
        ],
      }
    `);
  });
});
