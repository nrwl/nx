import { generateFiles, offsetFromRoot, toJS, Tree } from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  const rootOffset = offsetFromRoot(options.appProjectRoot);
  generateFiles(host, join(__dirname, '../files/app'), options.appProjectRoot, {
    ...options,
    offsetFromRoot: rootOffset,
    rootTsConfigPath: rootOffset + getRootTsConfigPathInTree(host),
  });
  if (options.unitTestRunner === 'none') {
    host.delete(join(options.appProjectRoot, `/src/app/App.spec.tsx`));
  }
  if (options.e2eTestRunner === 'none') {
    host.delete(
      join(
        options.androidProjectRoot,
        `/app/src/androidTest/java/com/${options.lowerCaseName}/DetoxTest.java`
      )
    );
  }
  if (options.js) {
    toJS(host);
  }
}
