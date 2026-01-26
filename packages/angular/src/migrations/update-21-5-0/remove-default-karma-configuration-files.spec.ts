import {
  addProjectConfiguration,
  readProjectConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-default-karma-configuration-files';

const DEFAULT_KARMA_CONFIG_WITH_DEVKIT = `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with \`random: false\`
        // or set a specific seed with \`seed: 4321\`
      },
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
`;

const DEFAULT_KARMA_CONFIG_NO_DEVKIT = `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
`;

describe('Migration to remove default Karma configuration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function addAngularProject(
    projectName: string,
    executor: string,
    karmaConfigPath?: string,
    projectType: 'application' | 'library' = 'application'
  ): void {
    const projectConfig: ProjectConfiguration = {
      root: '',
      sourceRoot: 'src',
      projectType,
      targets: {
        test: {
          executor,
          options: karmaConfigPath ? { karmaConfig: karmaConfigPath } : {},
        },
      },
    };

    addProjectConfiguration(tree, projectName, projectConfig);
  }

  it('should delete default karma.conf.js and remove karmaConfig option', async () => {
    const karmaConfigPath = 'karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      karmaConfigPath
    );
    tree.write(karmaConfigPath, DEFAULT_KARMA_CONFIG_WITH_DEVKIT);

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBeUndefined();
    expect(tree.exists(karmaConfigPath)).toBeFalsy();
  });

  it('should not delete modified karma.conf.js', async () => {
    const karmaConfigPath = 'apps/app/karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      karmaConfigPath
    );
    tree.write(
      karmaConfigPath,
      `
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
    ],
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
  });
};
`
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBe(karmaConfigPath);
    expect(tree.exists(karmaConfigPath)).toBeTruthy();
  });

  it('should not delete karma.conf.js with unsupported values', async () => {
    const karmaConfigPath = 'apps/app/karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      karmaConfigPath
    );
    tree.write(
      karmaConfigPath,
      `
const myPlugin = require('my-plugin');
module.exports = function (config) {
  config.set({
    plugins: [myPlugin],
  });
};
`
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBe(karmaConfigPath);
    expect(tree.exists(karmaConfigPath)).toBeTruthy();
  });

  it('should handle multiple projects referencing the same karma.conf.js', async () => {
    const sharedKarmaConfig = 'karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      sharedKarmaConfig
    );

    const projectConfig2: ProjectConfiguration = {
      root: 'app2',
      sourceRoot: 'app2/src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            karmaConfig: sharedKarmaConfig,
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app2', projectConfig2);

    tree.write(sharedKarmaConfig, DEFAULT_KARMA_CONFIG_WITH_DEVKIT);

    await migration(tree);

    const project1 = readProjectConfiguration(tree, 'app');
    const project2 = readProjectConfiguration(tree, 'app2');
    expect(project1.targets.test.options.karmaConfig).toBeUndefined();
    expect(project2.targets.test.options.karmaConfig).toBeUndefined();
    expect(tree.exists(sharedKarmaConfig)).toBeFalsy();
  });

  it('should not error for a non-existent karma config file', async () => {
    const nonExistentConfig = 'karma.non-existent.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      nonExistentConfig
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBe(nonExistentConfig);
  });

  it('should work for library projects', async () => {
    const karmaConfigPath = 'karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      karmaConfigPath,
      'library'
    );
    tree.write(
      karmaConfigPath,
      `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
`
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBeUndefined();
    expect(tree.exists(karmaConfigPath)).toBeFalsy();
  });

  it('should handle multiple configurations in the test target', async () => {
    const karmaConfigPath = 'karma.conf.js';
    const ciKarmaConfig = 'karma.ci.conf.js';

    const projectConfig: ProjectConfiguration = {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            karmaConfig: karmaConfigPath,
          },
          configurations: {
            ci: {
              karmaConfig: ciKarmaConfig,
            },
          },
        },
      },
    };

    addProjectConfiguration(tree, 'app', projectConfig);
    tree.write(
      karmaConfigPath,
      `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
`
    );
    tree.write(
      ciKarmaConfig,
      `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    browsers: ['ChromeHeadless'],
  });
};
`
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBeUndefined();
    expect(project.targets.test.configurations.ci.karmaConfig).toBe(
      ciKarmaConfig
    );
    expect(tree.exists(karmaConfigPath)).toBeFalsy();
    expect(tree.exists(ciKarmaConfig)).toBeTruthy();
  });

  it('should handle karma config in a subdirectory', async () => {
    const karmaConfigPath = 'src/karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      karmaConfigPath
    );
    tree.write(
      karmaConfigPath,
      `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, '../coverage/app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
`
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBeUndefined();
    expect(tree.exists(karmaConfigPath)).toBeFalsy();
  });

  it('should not delete almost default karma.conf.js', async () => {
    const karmaConfigPath = 'karma.conf.js';
    addAngularProject(
      'app',
      '@angular-devkit/build-angular:karma',
      karmaConfigPath
    );
    tree.write(
      karmaConfigPath,
      `
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true,
    singleRun: true
  });
};
`
    );

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBe(karmaConfigPath);
    expect(tree.exists(karmaConfigPath)).toBeTruthy();
  });

  it('should delete default karma.conf.js when devkit is not used', async () => {
    const karmaConfigPath = 'karma.conf.js';
    addAngularProject('app', '@angular/build:karma', karmaConfigPath);
    tree.write(karmaConfigPath, DEFAULT_KARMA_CONFIG_NO_DEVKIT);

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.test.options.karmaConfig).toBeUndefined();
    expect(tree.exists(karmaConfigPath)).toBeFalsy();
  });
});
