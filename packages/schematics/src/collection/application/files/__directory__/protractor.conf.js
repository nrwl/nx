// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter } = require('jasmine-spec-reporter');
const { getAppDirectoryUsingCliConfig } = require('@nrwl/schematics/src/utils/cli-config-utils');
const appDir = getAppDirectoryUsingCliConfig();

exports.config = {
  allScriptsTimeout: 11000,
  specs: [
    appDir + '/e2e/**/*.e2e-spec.ts'
  ],
  capabilities: {
    'browserName': 'chrome'
  },
  directConnect: true,
  baseUrl: 'http://localhost:4200/',
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    print: function() {}
  },
  onPrepare() {
    const protractorImageComparison = require('protractor-image-comparison');
    browser.protractorImageComparison = new protractorImageComparison({
      baselineFolder: appDir + '/e2e/baseline-screenshots',
      screenshotPath: appDir + '/e2e/current-screenshots',
      autoSaveBaseline: true,
      disableCSSAnimation: true,
      hideScrollBars: true,
      ignoreAntialiasing: true,
      autoSaveBaseline: true
    });
    require('ts-node').register({
      project: appDir + '/e2e/tsconfig.e2e.json'
    });
    jasmine.getEnv().addReporter(new SpecReporter({ spec: { displayStacktrace: true } }));
  }
};
