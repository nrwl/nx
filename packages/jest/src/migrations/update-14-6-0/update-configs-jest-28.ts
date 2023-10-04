import { addDependenciesToPackageJson, readJson, Tree } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { isStringLiteralLike, PropertyAssignment } from 'typescript';
import { JestExecutorOptions } from '../../executors/jest/schema';
import {
  findRootJestConfig,
  findRootJestPreset,
} from '../../utils/config/find-root-jest-files';

const jestVersion = '28.1.1';

const JASMINE_TEST_RUNNER = /(testRunner:\s*['"`])(jest-jasmine2)(['"`])/g;
const JSDOM_TEST_ENV = /(testEnvironment:\s*['"`])(jsdom)(['"`])/g;

export function updateConfigsJest28(tree: Tree) {
  let devDeps = checkDeps(tree);
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options) => {
      if (options.jestConfig && tree.exists(options.jestConfig)) {
        const updatedConfig = updateJestConfig(
          tree.read(options.jestConfig, 'utf-8')
        );

        tree.write(options.jestConfig, updatedConfig);

        const projectConfigCheck = testFileForDep(updatedConfig);
        devDeps = { ...devDeps, ...projectConfigCheck };
      }
    }
  );

  return addDependenciesToPackageJson(tree, {}, devDeps);
}

export function updateJestConfig(config: string): string {
  let content = tsquery.replace(
    config,
    'PropertyAssignment:has(Identifier[name="testURL"])',
    (node: PropertyAssignment) => {
      const value = node?.initializer?.getText();
      return `testEnvironmentOptions: {url: ${value}}`;
    }
  );

  content = tsquery.replace(
    content,
    'PropertyAssignment > Identifier[name="extraGlobals"]',
    () => {
      return 'sandboxInjectedGlobals';
    }
  );

  return tsquery.replace(
    content,
    'PropertyAssignment:has(Identifier[name="timers"])',
    (node: PropertyAssignment) => {
      // must guard against non string properties as that means it's already been manually migrated
      if (node?.initializer && isStringLiteralLike(node.initializer)) {
        const value = node?.initializer.getText().trim() as
          | 'fake'
          | 'modern'
          | 'real'
          | 'legacy';

        // use .includes to ignore the different quotes (' " `)
        if (value.includes('fake') || value.includes('modern')) {
          return `fakeTimers: { enableGlobally: true }`;
        }
        if (value.includes('real')) {
          return `fakeTimers: { enableGlobally: false }`;
        }
        if (value.includes('legacy')) {
          return `fakeTimers: { enableGlobally: true, legacyFakeTimers: true }`;
        }
      }
    }
  );
}

export function checkDeps(tree: Tree): Record<string, string> {
  const packageJson = readJson(tree, 'package.json');
  let devDeps = {};

  if (packageJson.devDependencies['jest-preset-angular']) {
    devDeps['jest-environment-jsdom'] = jestVersion;
  }

  const rootJestConfig = findRootJestConfig(tree);
  if (rootJestConfig) {
    const rootConfigCheck = testFileForDep(tree.read(rootJestConfig, 'utf-8'));
    devDeps = { ...devDeps, ...rootConfigCheck };
  }

  const rootJestPreset = findRootJestPreset(tree);
  if (rootJestPreset) {
    const rootPresetCheck = testFileForDep(tree.read(rootJestPreset, 'utf-8'));
    devDeps = { ...devDeps, ...rootPresetCheck };
  }

  return devDeps;
}

function testFileForDep(config: string): Record<string, string> {
  const deps = {};
  if (JASMINE_TEST_RUNNER.test(config)) {
    deps['jest-jasmine2'] = jestVersion;
  }
  if (JSDOM_TEST_ENV.test(config)) {
    deps['jest-environment-jsdom'] = jestVersion;
  }
  return deps;
}

export default updateConfigsJest28;
