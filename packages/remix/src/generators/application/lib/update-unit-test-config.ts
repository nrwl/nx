import {
  addDependenciesToPackageJson,
  joinPathFragments,
  stripIndents,
  type Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import {
  updateJestTestSetup,
  updateVitestTestIncludes,
  updateVitestTestSetup,
} from '../../../utils/testing-config-utils';
import {
  getRemixVersion,
  testingLibraryJestDomVersion,
  testingLibraryReactVersion,
  testingLibraryUserEventsVersion,
} from '../../../utils/versions';

export function updateUnitTestConfig(
  tree: Tree,
  pathToRoot: string,
  unitTestRunner: 'vitest' | 'jest',
  rootProject: boolean
) {
  const pathToTestSetup = joinPathFragments(pathToRoot, `test-setup.ts`);
  tree.write(
    pathToTestSetup,
    stripIndents`
  import { installGlobals } from '@remix-run/node';
  import '@testing-library/jest-dom/matchers';
  installGlobals();`
  );

  if (unitTestRunner === 'vitest') {
    const pathToViteConfig = joinPathFragments(pathToRoot, 'vitest.config.ts');
    updateVitestTestIncludes(
      tree,
      pathToViteConfig,
      './app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    );
    updateVitestTestIncludes(
      tree,
      pathToViteConfig,
      './tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    );
    updateVitestTestSetup(tree, pathToViteConfig, 'test-setup.ts');
  } else if (unitTestRunner === 'jest' && rootProject) {
    const pathToJestConfig = joinPathFragments(pathToRoot, 'jest.config.ts');
    tree.write('jest.preset.cjs', tree.read('jest.preset.js', 'utf-8'));
    updateJestTestSetup(tree, pathToJestConfig, `<rootDir>/test-setup.ts`);
    tree.write(
      pathToJestConfig,
      tree
        .read(pathToJestConfig, 'utf-8')
        .replace('jest.preset.js', 'jest.preset.cjs')
    );
  }

  const pathToTsConfigSpec = joinPathFragments(
    pathToRoot,
    `tsconfig.spec.json`
  );

  updateJson(tree, pathToTsConfigSpec, (json) => {
    json.include = [
      'vite.config.ts',
      'vitest.config.ts',
      'app/**/*.ts',
      'app/**/*.tsx',
      'app/**/*.js',
      'app/**/*.jsx',
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.tsx',
      'tests/**/*.test.tsx',
      'tests/**/*.spec.js',
      'tests/**/*.test.js',
      'tests/**/*.spec.jsx',
      'tests/**/*.test.jsx',
    ];

    return json;
  });

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@testing-library/jest-dom': testingLibraryJestDomVersion,
      '@testing-library/react': testingLibraryReactVersion,
      '@testing-library/user-event': testingLibraryUserEventsVersion,
      '@remix-run/node': getRemixVersion(tree),
      '@remix-run/testing': getRemixVersion(tree),
    }
  );
}
