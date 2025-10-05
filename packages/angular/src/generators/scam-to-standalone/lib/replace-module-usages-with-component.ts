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
      // Word boundary \b ensures that other modules won't be affected.
      // E.g. "MapIconModule" would not be affected when "IconModule" is being migrated.
      const moduleNameRegex = new RegExp(`\\b${moduleName}\\b`, 'g');
      const newFileContents = fileContents.replace(
        moduleNameRegex,
        componentName
      );
      tree.write(path, newFileContents);
    }
  });
}
