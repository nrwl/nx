import { joinPathFragments, updateJson, type Tree } from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';
import { getNeededCompilerOptionOverrides } from '@nx/js/internal';
import { getDefinedCompilerOption } from '../../utils/tsconfig-utils';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { enableStrictTypeChecking } from './enable-strict-type-checking';
import type { NormalizedSchema } from './normalized-schema';

export function updateTsconfigFiles(tree: Tree, options: NormalizedSchema) {
  enableStrictTypeChecking(tree, options);

  const compilerOptions: Record<string, any> = {
    skipLibCheck: true,
    experimentalDecorators: true,
    importHelpers: true,
    isolatedModules: true,
    target: 'es2022',
    moduleResolution: 'bundler',
  };

  const rootTsConfigPath = getRootTsConfigFileName(tree);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  // Angular warns about emitDecoratorMetadata when isolatedModules is enabled,
  // so disable it if it's set in the root tsconfig.
  if (
    getDefinedCompilerOption(
      tree,
      rootTsConfigPath,
      'emitDecoratorMetadata'
    ) === true
  ) {
    compilerOptions.emitDecoratorMetadata = false;
  }
  if (angularMajorVersion >= 21) {
    compilerOptions.moduleResolution = 'bundler';
  }
  compilerOptions.module = 'preserve';

  const tsconfigPath = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.json'
  );
  updateJson(tree, tsconfigPath, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      ...compilerOptions,
    };
    // For standalone projects, rootTsConfigPath and tsconfigPath are the same
    // file. Calling getNeededCompilerOptionOverrides would compare the file
    // against itself and strip options like skipLibCheck that are already set.
    if (tsconfigPath !== rootTsConfigPath) {
      json.compilerOptions = getNeededCompilerOptionOverrides(
        tree,
        json.compilerOptions,
        rootTsConfigPath
      );
    }
    return json;
  });

  if (options.unitTestRunner === 'jest') {
    const tsconfigSpecPath = joinPathFragments(
      options.appProjectRoot,
      'tsconfig.spec.json'
    );
    updateJson(tree, tsconfigSpecPath, (json) => {
      json.compilerOptions = {
        ...json.compilerOptions,
        module: 'commonjs',
        moduleResolution: 'node10',
      };
      json.compilerOptions = getNeededCompilerOptionOverrides(
        tree,
        json.compilerOptions,
        tsconfigPath
      );
      return json;
    });
  }
}
