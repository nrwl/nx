// go through the jest.config files
// replace testPathPattern with testPathPatterns

import { globAsync, Tree } from '@nx/devkit';

export default async function update(tree: Tree) {

  const jestConfigPaths = await globAsync(tree, [
    '**/jest.config.{cjs,mjs,js,cts,mts,ts}',
  ]);
  jestConfigPaths.forEach((jestConfigPath) => {
    const oldContent = tree.read(jestConfigPath).toString();
    if (oldContent?.includes('testPathPattern:')) {
      let newContent = oldContent.replace(
        'testPathPattern:',
        'testPathPatterns:'
      );

      tree.write(jestConfigPath, newContent);
    }
  });
}
