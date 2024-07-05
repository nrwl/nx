import { Tree, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-regex-test-production';

describe('change-regex-test-production', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not add to the namedInputs if it does not exist', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({ namedInputs: {}, plugins: ['@nx/gradle'] })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {},
        "plugins": [
          "@nx/gradle",
        ],
      }
    `);
  });

  it('should not add to the namedInputs production if it is empty', async () => {
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
          "production": [],
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
          "production": [
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
