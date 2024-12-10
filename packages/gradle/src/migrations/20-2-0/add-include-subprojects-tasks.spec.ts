import { Tree, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-include-subprojects-tasks';

describe('AddIncludeSubprojectsTasks', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not change nx.json if @nx/gradle is not added', async () => {
    tree.write('nx.json', JSON.stringify({ namedInputs: {} }));
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {},
      }
    `);
  });

  it('should add includeSubprojectsTasks to @nx/gradle plugin', async () => {
    tree.write('nx.json', JSON.stringify({ plugins: ['@nx/gradle'] }));
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "plugins": [
          {
            "options": {
              "includeSubprojectsTasks": true,
            },
            "plugin": "@nx/gradle",
          },
        ],
      }
    `);
  });

  it('should add includeSubprojectsTasks to @nx/gradle plugin with options', async () => {
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
              "includeSubprojectsTasks": true,
              "testTargetName": "test",
            },
            "plugin": "@nx/gradle",
          },
        ],
      }
    `);
  });
});
