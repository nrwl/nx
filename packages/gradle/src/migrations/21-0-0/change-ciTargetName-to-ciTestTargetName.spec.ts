import { Tree, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-ciTargetName-to-ciTestTargetName';

describe('change ciTargetName to ciTestTargetName', () => {
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

  it('should not add options to @nx/gradle if it have any options', async () => {
    tree.write('nx.json', JSON.stringify({ plugins: ['@nx/gradle'] }));
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "plugins": [
          "@nx/gradle",
        ],
      }
    `);
  });

  it('should not add options to @nx/gradle/plugin-v1', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({ plugins: ['@nx/gradle/plugin-v1'] })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "plugins": [
          "@nx/gradle/plugin-v1",
        ],
      }
    `);
  });

  it('should not change to @nx/gradle plugin if ciTargetName does not exist', async () => {
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
            "plugin": "@nx/gradle",
          },
        ],
      }
    `);
  });

  it('should change to @nx/gradle plugin ciTargetName', async () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        plugins: [{ plugin: '@nx/gradle', options: { ciTargetName: 'test' } }],
      })
    );
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "plugins": [
          {
            "options": {
              "ciTestTargetName": "test",
            },
            "plugin": "@nx/gradle",
          },
        ],
      }
    `);
  });
});
