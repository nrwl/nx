import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { findFileInClosestParentFolder } from '@nx/devkit/src/utils/find-file-in-closest-parent.folder';

describe(findFileInClosestParentFolder.name, () => {
  it.each([
    [
      'in the same folder',
      {
        files: ['libs/my-lib/my.config.ts'],
        expectedFile: 'libs/my-lib/my.config.ts',
      },
    ],
    [
      'in parent folder',
      {
        files: ['libs/my.config.ts'],
        expectedFile: 'libs/my.config.ts',
      },
    ],
    [
      'in root',
      {
        files: ['my.config.ts'],
        expectedFile: 'my.config.ts',
      },
    ],
    [
      'in closest parent',
      {
        files: ['my.config.ts', 'libs/my.config.ts'],
        expectedFile: 'libs/my.config.ts',
      },
    ],
  ])('should find file %s', async (_, { files, expectedFile }) => {
    const { tree } = setUp();

    for (const file of files) {
      tree.write(file, '{}');
    }

    expect(
      findFileInClosestParentFolder({
        tree,
        path: 'libs/my-lib',
        fileName: 'my.config.ts',
      })
    ).toBe(expectedFile);
  });

  it('should not search beyond workspace root', async () => {
    const { tree } = setUp();

    tree.write('../package.json', '{}');

    expect(
      findFileInClosestParentFolder({
        tree,
        path: 'libs/my-lib',
        fileName: 'my.config.ts',
      })
    ).toBeNull();
  });
});

function setUp() {
  return {
    tree: createTreeWithEmptyWorkspace(),
  };
}
