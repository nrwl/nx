import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addVitestTempFilesToGitIgnore from './add-vitest-temp-files-to-git-ignore';

describe('addVitestTempFilesToGitIgnore', () => {
  it('should update an existing .gitignore file to add the glob correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '.idea');

    // ACT
    addVitestTempFilesToGitIgnore(tree);

    // ASSERT
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      ".idea
      vitest.config.*.timestamp*"
    `);
  });

  it('should update an existing .gitignore file and remove incorrect glob and add the glob correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      '.gitignore',
      `.idea
      **/vitest.config.{js,ts,mjs,mts,cjs,cts}.timestamp*`
    );

    // ACT
    addVitestTempFilesToGitIgnore(tree);

    // ASSERT
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      ".idea

      vitest.config.*.timestamp*"
    `);
  });

  it('should write a new .gitignore file to add the glob correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.delete('.gitignore');

    // ACT
    addVitestTempFilesToGitIgnore(tree);

    // ASSERT
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      "vitest.config.*.timestamp*"
    `);
  });
});
