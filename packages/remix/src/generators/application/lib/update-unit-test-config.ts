import {
  addDependenciesToPackageJson,
  joinPathFragments,
  stripIndents,
  type Tree,
} from '@nx/devkit';
import {
  updateJestTestSetup,
  updateViteTestIncludes,
  updateViteTestSetup,
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
  unitTestRunner: 'vitest' | 'jest'
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
    const pathToViteConfig = joinPathFragments(pathToRoot, 'vite.config.ts');
    updateViteTestIncludes(
      tree,
      pathToViteConfig,
      './app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    );
    updateViteTestSetup(tree, pathToViteConfig, './test-setup.ts');
  } else if (unitTestRunner === 'jest') {
    const pathToJestConfig = joinPathFragments(pathToRoot, 'jest.config.ts');
    updateJestTestSetup(tree, pathToJestConfig, `<rootDir>/test-setup.ts`);
  }

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
