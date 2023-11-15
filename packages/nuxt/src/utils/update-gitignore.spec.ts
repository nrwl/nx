import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import { updateGitIgnore } from './update-gitignore';

describe('update gitignore', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add entries to .gitignore if they do not exist', () => {
    tree.write(
      '.gitignore',
      `
# See http://help.github.com/ignore-files/ for more about ignoring files.

# compiled output
dist
tmp
/out-tsc

# dependencies
node_modules

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace
.output_data
`
    );

    updateGitIgnore(tree);

    expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
  });

  it('should not add duplicate entries to .gitignore if they already exist', () => {
    tree.write(
      '.gitignore',
      `
# See http://help.github.com/ignore-files/ for more about ignoring files.

# compiled output
dist
tmp
/out-tsc

# dependencies
node_modules

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# Nuxt dev/build outputs
.output
.data
.nuxt
.nitro
.cache
`
    );

    updateGitIgnore(tree);

    expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
  });
});
