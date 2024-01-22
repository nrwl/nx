import { generateFiles, offsetFromRoot, toJS, Tree } from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, '../files/app'), options.appProjectRoot, {
    ...options,
    entryFileIos: 'src/main',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    rootTsConfigPath: getRelativePathToRootTsConfig(
      host,
      options.appProjectRoot
    ),
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
