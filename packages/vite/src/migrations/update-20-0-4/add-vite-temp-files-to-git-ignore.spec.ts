import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addViteTempFilesToGitIgnore from './add-vite-temp-files-to-git-ignore';

describe('addViteTempFilesToGitIgnore', () => {
  it('should update an existing .gitignore file to add the glob correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '.idea');

    // ACT
    addViteTempFilesToGitIgnore(tree);

    // ASSERT
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      ".idea
      **/vite.config.{js,ts,mjs,mts,cjs,cts}.timestamp*"
    `);
  });

  it('should write a new .gitignore file to add the glob correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.delete('.gitignore');

    // ACT
    addViteTempFilesToGitIgnore(tree);

    // ASSERT
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(
      `"**/vite.config.{js,ts,mjs,mts,cjs,cts}.timestamp*"`
    );
  });
});
