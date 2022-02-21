import { addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import migrateKarmaConfig from './migrate-karma-conf';

describe('Migrate Karma Config', () => {
  it('should successfully migrate outdate karma setup', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    tree.write(
      'karma.conf.js',
      `// Karma configuration file, see link for more information
        // https://karma-runner.github.io/1.0/config/configuration-file.html
        
        const { join } = require('path');
        const { constants } = require('karma');
        
        module.exports = () => {
          return {
            basePath: '',
            frameworks: ['jasmine', '@angular-devkit/build-angular'],
            plugins: [
              require('karma-jasmine'),
              require('karma-chrome-launcher'),
              require('karma-jasmine-html-reporter'),
              require('karma-coverage-istanbul-reporter'),
              require('@angular-devkit/build-angular/plugins/karma'),
            ],
            client: {
              clearContext: false, // leave Jasmine Spec Runner output visible in browser
            },
            coverageIstanbulReporter: {
              dir: join(__dirname, '../../coverage'),
              reports: ['html', 'lcovonly'],
              fixWebpackSourcePaths: true,
            },
            reporters: ['progress', 'kjhtml'],
            port: 9876,
            colors: true,
            logLevel: constants.LOG_INFO,
            autoWatch: true,
            browsers: ['Chrome'],
            singleRun: true,
          };
        };`
    );

    addProjectConfiguration(tree, 'test', {
      root: 'apps/test',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            karmaConfig: 'karma.conf.js',
          },
        },
      },
    });

    tree.write(
      'apps/test/karma.conf.js',
      `// Karma configuration file, see link for more information
    // https://karma-runner.github.io/1.0/config/configuration-file.html
    
    const { join } = require('path');
    const getBaseKarmaConfig = require('../../karma.conf');
    
    module.exports = function(config) {
      const baseConfig = getBaseKarmaConfig();
      config.set({
        ...baseConfig,
        coverageIstanbulReporter: {
          ...baseConfig.coverageIstanbulReporter,
          dir: join(__dirname, '../../coverage/apps/test')
        }
      });
    };`
    );

    // ACT
    await migrateKarmaConfig(tree);

    // ASSERT
    const packageJson = tree.read('package.json', 'utf-8');
    const rootKarmaContents = tree.read('karma.conf.js', 'utf-8');
    const appKarmaContents = tree.read('apps/test/karma.conf.js', 'utf-8');

    expect(packageJson).toMatchSnapshot();
    expect(rootKarmaContents).toMatchSnapshot();
    expect(appKarmaContents).toMatchSnapshot();
  });
});
