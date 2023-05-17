import {
  Tree,
  formatFiles,
  getProjects,
  updateJson,
  ProjectConfiguration,
} from '@nx/devkit';

/**
 * Update .detoxrc.json under detox project:
 * - remove deprecated keys: testRunner
 * - update keys: runnerConfig
 * Update jest.config.json under detox project:
 * - remove key: transform
 * - add key: rootDir, testMatch, reporter, globalSetup, globalTeardown, verbose
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.['test-ios']?.executor !== '@nx/detox:test') return;
    updateDetoxrcJson(tree, project);
    updateJestConfigJson(tree, project);
  });

  await formatFiles(tree);
}

function updateDetoxrcJson(host: Tree, project: ProjectConfiguration) {
  const detoxConfigPath = `${project.root}/.detoxrc.json`;
  if (!host.exists(detoxConfigPath)) return;
  updateJson(host, detoxConfigPath, (json) => {
    json.testRunner = {
      args: {
        $0: 'jest',
        config: './jest.config.json',
      },
      jest: {
        setupTimeout: 120000,
      },
    };
    if (json.runnerConfig) {
      delete json.runnerConfig;
    }
    return json;
  });
}

function updateJestConfigJson(host: Tree, project: ProjectConfiguration) {
  const jestConfigPath = `${project.root}/jest.config.json`;
  if (!host.exists(jestConfigPath)) return;
  updateJson(host, jestConfigPath, (json) => {
    if (json.transform) {
      delete json.transform;
    }
    if (!json.rootDir) {
      json.rootDir = '.';
    }
    if (!json.testMatch) {
      json.testMatch = [
        '<rootDir>/src/**/*.test.ts?(x)',
        '<rootDir>/src/**/*.spec.ts?(x)',
      ];
    }
    json.reporter = ['detox/runners/jest/reporter'];
    json.globalSetup = 'detox/runners/jest/globalSetup';
    json.globalTeardown = 'detox/runners/jest/globalTeardown';
    json.verbose = true;
    return json;
  });
}
