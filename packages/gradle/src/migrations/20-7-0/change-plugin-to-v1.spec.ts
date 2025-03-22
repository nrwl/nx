import { Tree, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-plugin-to-v1';

describe('ChangePluginToV1', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not add @nx/gradle plugin if it does not exist', async () => {
    tree.write('nx.json', JSON.stringify({ namedInputs: {} }));
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {},
      }
    `);
  });

  it('should change @nx/gradle to @nx/gradle/plugin-v1 plugin', async () => {
    tree.write('nx.json', JSON.stringify({ plugins: ['@nx/gradle'] }));
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "plugins": [
          "@nx/gradle/plugin-v1",
        ],
      }
    `);
  });

  it('should add change to @nx/gradle plugin with options', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        plugins: [
          { plugin: '@nx/gradle', options: { testTargetName: 'test' } },
        ],
      })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "plugins": [
          {
            "options": {
              "testTargetName": "test",
            },
            "plugin": "@nx/gradle/plugin-v1",
          },
        ],
      }
    `);
  });
});
