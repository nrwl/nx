import { Tree } from 'nx/src/generators/tree';
import { visitNotIgnoredFiles } from '@nx/devkit';
import { extname } from 'path';

export function replaceModuleUsagesWithComponent(
  tree: Tree,
  moduleName: string,
  componentName: string
) {
  visitNotIgnoredFiles(tree, '/', (path) => {
    if (extname(path) !== '.ts') {
      return;
    }
    const fileContents = tree.read(path, 'utf-8');
    if (fileContents.includes(moduleName)) {
      const moduleNameRegex = new RegExp(moduleName, 'g');
      const newFileContents = fileContents.replace(
        moduleNameRegex,
        componentName
      );
      tree.write(path, newFileContents);
    }
  });
}
