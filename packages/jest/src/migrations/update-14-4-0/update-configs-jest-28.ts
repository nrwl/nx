import { addDependenciesToPackageJson, readJson, Tree } from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '../../executors/jest/schema';
import {
  findRootJestConfig,
  findRootJestPreset,
} from '../../utils/config/find-root-jest-files';
import { jestVersion } from '../../utils/versions';

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
  return config
    .replace(
      /(testURL:\s*['"`])(.*)(['"`])/g,
      'testEnvironmentOptions: {url: $3$2$3}'
    )
    .replace(/(extraGlobals)/g, `sandboxInjectedGlobals`)
    .replace(
      /(timers:\s*['"`])(real)(['"`])/g,
      'fakeTimers: { enableGlobally: false }'
    )
    .replace(
      /(timers:\s*['"`])(fake|modern)(['"`])/g,
      'fakeTimers: { enableGlobally: true }'
    )
    .replace(
      /(timers:\s*['"`])(legacy)(['"`])/g,
      'fakeTimers: { enableGlobally: true, legacyFakeTimers: true }'
    );
}

export function checkDeps(tree: Tree): Record<string, string> {
  const packageJson = readJson(tree, 'package.json');
  let devDeps = {};

  if (packageJson.devDependencies['jest-jasmine2']) {
    devDeps['jest-jasmine2'] = jestVersion;
  }
  if (
    packageJson.devDependencies['jest-environment-jsdom'] ||
    packageJson.devDependencies['jest-preset-angular']
  ) {
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
