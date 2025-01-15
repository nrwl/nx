import {
  detectPackageManager,
  generateFiles,
  getPackageManagerCommand,
  offsetFromRoot as _offsetFromRoot,
  toJS,
  Tree,
  writeJson,
  joinPathFragments,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';

export function createFiles(host: Tree, options: NormalizedSchema) {
  const offsetFromRoot = _offsetFromRoot(options.e2eProjectRoot);
  const rootTsConfigPath = getRelativePathToRootTsConfig(
    host,
    options.e2eProjectRoot
  );
  generateFiles(host, join(__dirname, '../files/app'), options.e2eProjectRoot, {
    ...options,
    exec: getPackageManagerCommand(detectPackageManager(host.root)).exec,
    offsetFromRoot,
    rootTsConfigPath,
  });
  if (options.isUsingTsSolutionConfig) {
    writeJson(
      host,
      joinPathFragments(options.e2eProjectRoot, 'tsconfig.json'),
      {
        extends: `${offsetFromRoot}tsconfig.base.json`,
        compilerOptions: {
          sourceMap: false,
          outDir: 'out-tsc/detox',
          allowJs: true,
          types: ['node', 'jest', 'detox'],
        },
        include: ['src/**/*.ts', 'src/**/*.js'],
        exclude: ['out-tsc', 'test-output'],
      }
    );
  } else {
    generateFiles(
      host,
      join(__dirname, '../files/non-ts-solution'),
      options.e2eProjectRoot,
      {
        ...options,
        offsetFromRoot,
        rootTsConfigPath,
      }
    );
  }
  if (options.js) {
    toJS(host);
  }
}
