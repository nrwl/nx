import {
  addDependenciesToPackageJson,
  joinPathFragments,
  stripIndents,
  type Tree,
} from '@nx/devkit';
import {
  updateJestTestSetup,
  updateVitestTestSetup,
} from '../../../utils/testing-config-utils';
import {
  getRemixVersion,
  testingLibraryJestDomVersion,
  testingLibraryReactVersion,
  testingLibraryUserEventsVersion,
} from '../../../utils/versions';
import type { RemixLibraryOptions } from './normalize-options';

export function addUnitTestingSetup(tree: Tree, options: RemixLibraryOptions) {
  const pathToTestSetup = joinPathFragments(
    options.projectRoot,
    'src/test-setup.ts'
  );
  let testSetupFileContents = '';

  if (tree.exists(pathToTestSetup)) {
    testSetupFileContents = tree.read(pathToTestSetup, 'utf-8');
  }

  tree.write(
    pathToTestSetup,
    stripIndents`${testSetupFileContents}
    import { installGlobals } from '@remix-run/node';
    import "@testing-library/jest-dom/matchers";
  installGlobals();`
  );

  if (options.unitTestRunner === 'vitest') {
    const pathToVitestConfig = joinPathFragments(
      options.projectRoot,
      `vite.config.ts`
    );
    updateVitestTestSetup(tree, pathToVitestConfig, './src/test-setup.ts');
  } else if (options.unitTestRunner === 'jest') {
    const pathToJestConfig = joinPathFragments(
      options.projectRoot,
      `jest.config.ts`
    );
    updateJestTestSetup(tree, pathToJestConfig, './src/test-setup.ts');
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@testing-library/jest-dom': testingLibraryJestDomVersion,
      '@testing-library/react': testingLibraryReactVersion,
      '@testing-library/user-event': testingLibraryUserEventsVersion,
      '@remix-run/node': getRemixVersion(tree),
    }
  );
}
