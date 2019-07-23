import { readWorkspaceConfigPath, updateJsonFile } from '@nrwl/workspace';
import { writeFileSync, unlinkSync } from 'fs';
import { offsetFromRoot } from '@nrwl/workspace';
import * as path from 'path';

export default {
  description: 'Create tsconfig.app.json for every app',
  run: () => {
    const config = readWorkspaceConfigPath();
    config.apps.forEach(app => {
      if (!app.root.startsWith('apps/')) return;
      const offset = offsetFromRoot(app.root);
      writeFileSync(
        `${app.root}/tsconfig.app.json`,
        `{
  "extends": "${offset}tsconfig.json",
  "compilerOptions": {
    "outDir": "${offset}dist/out-tsc/apps/${app.name}",
    "module": "es2015"
  },
  "include": [
    "**/*.ts"
    /* add all lazy-loaded libraries here: "${offset}libs/my-lib/index.ts" */
  ],
  "exclude": [
    "**/*.spec.ts"
  ]
}`
      );

      writeFileSync(
        `${path.dirname(app.root)}/e2e/tsconfig.e2e.json`,
        `{
  "extends": "${offset}tsconfig.json",
  "compilerOptions": {
    "outDir": "${offset}dist/out-tsc/e2e/${app.name}",
    "module": "commonjs",
    "target": "es5",
    "types": [
      "jasmine",
      "jasminewd2",
      "node"
    ]
  },
  "include": [
    "../**/*.ts"
    /* add all lazy-loaded libraries here: "${offset}libs/my-lib/index.ts" */
  ],
  "exclude": [
    "**/*.spec.ts"
  ]
}`
      );
    });

    writeFileSync(
      'protractor.conf.js',
      `
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
    require('ts-node').register({
      project: appDir + '/e2e/tsconfig.e2e.json'
    });
    jasmine.getEnv().addReporter(new SpecReporter({ spec: { displayStacktrace: true } }));
  }
};`
    );

    writeFileSync(
      `tsconfig.spec.json`,
      `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/out-tsc/spec",
    "module": "commonjs",
    "target": "es5",
    "types": [
      "jasmine",
      "node"
    ]
  },
  "include": [
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "tmp"
  ]
}`
    );

    unlinkSync('tsconfig.app.json');
    unlinkSync('tsconfig.e2e.json');

    updateJsonFile('.angular-cli.json', json => {
      json.apps.forEach(app => {
        app['tsconfig'] = 'tsconfig.app.json';
      });
      json.lint = [
        {
          project: './tsconfig.spec.json',
          exclude: '**/node_modules/**'
        }
      ];
      json.apps.forEach(app => {
        if (!app.root.startsWith('apps/')) return;
        json.lint.push({
          project: `./${app.root}/tsconfig.app.json`,
          exclude: '**/node_modules/**'
        });
        json.lint.push({
          project: `./apps/${app.name}/e2e/tsconfig.e2e.json`,
          exclude: '**/node_modules/**'
        });
      });
    });
  }
};
