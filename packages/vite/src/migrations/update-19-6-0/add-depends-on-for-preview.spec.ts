import addDependsOnForPreview from './add-depends-on-for-preview';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson } from '@nx/devkit';

describe('addDependsOnForPreview', () => {
  it('should update when preview target exists in project.json', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/app/project.json',
      JSON.stringify({
        name: 'app',
        root: 'apps/app',
        projectType: 'application',
        targets: {
          preview: {
            executor: '@nx/vite:preview-server',
          },
        },
      })
    );

    // ACT
    await addDependsOnForPreview(tree);

    // ASSERT
    expect(readJson(tree, 'apps/app/project.json').targets)
      .toMatchInlineSnapshot(`
      {
        "preview": {
          "dependsOn": [
            "build",
          ],
          "executor": "@nx/vite:preview-server",
        },
      }
    `);
  });

  it('should not update when preview target exists in project.json and has a dependsOn already', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/app/project.json',
      JSON.stringify({
        name: 'app',
        root: 'apps/app',
        projectType: 'application',
        targets: {
          preview: {
            dependsOn: ['build'],
            executor: '@nx/vite:preview-server',
          },
        },
      })
    );

    // ACT
    await addDependsOnForPreview(tree);

    // ASSERT
    expect(readJson(tree, 'apps/app/project.json').targets)
      .toMatchInlineSnapshot(`
      {
        "preview": {
          "dependsOn": [
            "build",
          ],
          "executor": "@nx/vite:preview-server",
        },
      }
    `);
  });
});
