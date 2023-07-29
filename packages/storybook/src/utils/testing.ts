import { Tree } from '@nx/devkit';

import { libraryGenerator } from '@nx/js';
import { Linter } from '@nx/linter';

export async function createTestUILibNoNgDevkit(
  appTree: Tree,
  libName: string
): Promise<Tree> {
  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'none',
    name: libName,
  });

  return appTree;
}

export function deleteNewConfigurationAndCreateNew(
  appTree: Tree,
  projectStorybookRoot: string
): Tree {
  // Remove new Storybook configuration
  appTree.delete(`.storybook/main.js`);
  appTree.delete(`.storybook/tsconfig.json`);
  appTree.delete(`${projectStorybookRoot}/main.js`);
  appTree.delete(`${projectStorybookRoot}/preview.js`);
  appTree.delete(`${projectStorybookRoot}/tsconfig.json`);

  // Create old Storybook configuration
  appTree.write(`.storybook/addons.js`, 'console.log("hello")');
  appTree.write(`.storybook/webpack.config.js`, 'console.log("hello")');
  appTree.write(`.storybook/tsconfig.json`, '{"test": "hello"}');
  appTree.write(`${projectStorybookRoot}/config.js`, 'console.log("hello")');
  appTree.write(`${projectStorybookRoot}/addons.js`, 'console.log("hello")');
  appTree.write(
    `${projectStorybookRoot}/webpack.config.js`,
    'console.log("hello")'
  );
  appTree.write(`${projectStorybookRoot}/tsconfig.json`, '{"test": "hello"}');

  return appTree;
}
