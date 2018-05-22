import {
  chain,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

import { readJsonInTree, updateJsonInTree } from '../../src/utils/ast-utils';
import { FormatFiles } from '../../src/utils/tasks';
import { serializeJson } from '../../src/utils/fileutils';
import { parseTarget, serializeTarget } from '../../src/utils/cli-config-utils';
import * as fs from 'fs';
import { offsetFromRoot } from '@nrwl/schematics/src/utils/common';

function createKarma(host: Tree, project: any) {
  const offset = offsetFromRoot(project.root);

  createOrUpdate(
    host,
    `${project.root}/karma.conf.js`,
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
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, '${offset}coverage'),
      reports: ['html', 'lcovonly'],
      fixWebpackSourcePaths: true
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false
  });
};
    `
  );
}

function createProtractor(host: Tree, project: any) {
  createOrUpdate(
    host,
    `${project.root}/protractor.conf.js`,
    `
// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter } = require('jasmine-spec-reporter');

exports.config = {
  allScriptsTimeout: 11000,
  specs: [
    './src/**/*.e2e-spec.ts'
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
      project: require('path').join(__dirname, './tsconfig.e2e.json')
    });
    jasmine.getEnv().addReporter(new SpecReporter({ spec: { displayStacktrace: true } }));
  }
};
    `
  );
}

function createTestTs(host: Tree, project: any) {
  if (project.projectType === 'library') {
    createOrUpdate(
      host,
      `${project.sourceRoot}/test.ts`,
      `
// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'core-js/es7/reflect';
import 'zone.js/dist/zone';
import 'zone.js/dist/zone-testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

declare const require: any;

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
// Then we find all the tests.
const context = require.context('./', true, /\\.spec\\.ts$/);
// And load the modules.
context.keys().map(context);    
    `
    );
  } else {
    createOrUpdate(
      host,
      `${project.sourceRoot}/test.ts`,
      `
// This file is required by karma.conf.js and loads recursively all the .spec and framework files

  import 'zone.js/dist/zone-testing';
  import { getTestBed } from '@angular/core/testing';
  import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting
  } from '@angular/platform-browser-dynamic/testing';

  declare const require: any;

// First, initialize the Angular testing environment.
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
  );
// Then we find all the tests.
  const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
  context.keys().map(context);
    `
    );
  }
  return host;
}

function createBrowserlist(host: Tree, project: any) {
  createOrUpdate(
    host,
    `${project.root}/browserslist`,
    stripIndents`
      # This file is currently used by autoprefixer to adjust CSS to support the below specified browsers
      # For additional information regarding the format and rule options, please see:
      # https://github.com/browserslist/browserslist#queries
      # For IE 9-11 support, please uncomment the last line of the file and adjust as needed
      > 0.5%
      last 2 versions
      Firefox ESR
      not dead
      # IE 9-11
    `
  );
}

function createTsconfigSpecJson(host: Tree, project: any) {
  const files = ['src/test.ts'];

  const offset = offsetFromRoot(project.root);

  const compilerOptions = {
    outDir: `${offset}dist/out-tsc/${project.root}`,
    types: ['jasmine', 'node']
  };

  if (project.projectType === 'application') {
    files.push('src/polyfills.ts');
    compilerOptions['module'] = 'commonjs';
  }

  createOrUpdate(
    host,
    `${project.root}/tsconfig.spec.json`,
    serializeJson({
      extends: `${offset}tsconfig.json`,
      compilerOptions,
      files,
      include: ['**/*.spec.ts', '**/*.d.ts']
    })
  );
}

function createTslintJson(host: Tree, project: any) {
  const offset = offsetFromRoot(project.root);

  createOrUpdate(
    host,
    `${project.root}/tslint.json`,
    serializeJson({
      extends: `${offset}tslint.json`,
      rules: {
        'directive-selector': [true, 'attribute', project.prefix, 'camelCase'],
        'component-selector': [true, 'element', project.prefix, 'kebab-case']
      }
    })
  );
}

function createTsconfigLibJson(host: Tree, project: any) {
  const offset = offsetFromRoot(project.root);

  createOrUpdate(
    host,
    `${project.root}/tsconfig.lib.json`,
    serializeJson({
      extends: `${offset}tsconfig.json`,
      compilerOptions: {
        outDir: `${offset}out-tsc/${project.root}`,
        target: 'es2015',
        module: 'es2015',
        moduleResolution: 'node',
        declaration: true,
        sourceMap: true,
        inlineSources: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        importHelpers: true,
        types: [],
        lib: ['dom', 'es2015']
      },
      angularCompilerOptions: {
        annotateForClosureCompiler: true,
        skipTemplateCodegen: true,
        strictMetadataEmit: true,
        fullTemplateTypeCheck: true,
        strictInjectionParameters: true,
        flatModuleId: 'AUTOGENERATED',
        flatModuleOutFile: 'AUTOGENERATED'
      },
      exclude: ['src/test.ts', '**/*.spec.ts']
    })
  );
}

function createAdditionalFiles(host: Tree) {
  const angularJson = readJsonInTree(host, 'angular.json');
  Object.entries<any>(angularJson.projects).forEach(([key, project]) => {
    if (project.architect.test) {
      createTsconfigSpecJson(host, project);
      createKarma(host, project);
      createTestTs(host, project);
    }

    if (project.projectType === 'application' && !project.architect.e2e) {
      createBrowserlist(host, project);
      createTslintJson(host, project);
    }

    if (project.projectType === 'application' && project.architect.e2e) {
      createProtractor(host, project);
    }

    if (project.projectType === 'library') {
      createTsconfigLibJson(host, project);
      createTslintJson(host, project);
    }
  });
  return host;
}

function moveE2eTests(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');

  Object.values(angularJson.projects).forEach((p: any) => {
    if (p.projectType === 'application' && !p.architect.e2e) {
      fs.mkdirSync(`${p.root}-e2e`);
      fs.renameSync(`${p.root}/e2e`, `${p.root}-e2e/src`);
    }
  });
}

function deleteUnneededFiles(host: Tree) {
  try {
    host.delete('karma.conf.js');
    host.delete('protractor.conf.js');
    host.delete('tsconfig.spec.json');
    host.delete('test.js');
  } catch (e) {}
  return host;
}

function patchLibIndexFiles(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');

  Object.values(angularJson.projects).forEach((p: any) => {
    if (p.projectType === 'library') {
      try {
        fs.renameSync(p.sourceRoot, `${p.root}/lib`);
        fs.mkdirSync(p.sourceRoot);
        fs.renameSync(`${p.root}/lib`, `${p.sourceRoot}/lib`);
        const npmScope = readJsonInTree(host, 'nx.json').npmScope;
        host = updateJsonInTree('tsconfig.json', json => {
          json.compilerOptions.paths = json.compilerOptions.paths || {};
          json.compilerOptions.paths[
            `@${npmScope}/${p.root.replace('libs/', '')}`
          ] = [`${p.sourceRoot}/index.ts`];
          return json;
        })(host, context) as Tree;
        const content = host.read(`${p.root}/index.ts`).toString();
        host.create(
          `${p.sourceRoot}/index.ts`,
          content.replace(new RegExp('/src/', 'g'), '/lib/')
        );
        host.delete(`${p.root}/index.ts`);
      } catch (e) {
        console.warn(`Nx failed to successfully update '${p.root}'.`);
        console.warn(`Error message: ${e.message}`);
        console.warn(`PLease update the library manually.`);
      }
    }
  });

  return host;
}

const updatePackageJson = updateJsonInTree('package.json', json => {
  json.dependencies = json.dependencies || {};
  json.devDependencies = json.devDependencies || {};

  json.scripts = {
    ...json.scripts,
    'affected:test': './node_modules/.bin/nx affected:test'
  };

  json.dependencies = {
    ...json.dependencies,
    // Migrating Angular Dependencies because ng update @angular/core doesn't work well right now
    '@angular/animations': '6.0.1',
    '@angular/common': '6.0.1',
    '@angular/compiler': '6.0.1',
    '@angular/core': '6.0.1',
    '@angular/forms': '6.0.1',
    '@angular/platform-browser': '6.0.1',
    '@angular/platform-browser-dynamic': '6.0.1',
    '@angular/router': '6.0.1',
    rxjs: '6.0.0',
    'rxjs-compat': '6.0.0',
    'zone.js': '^0.8.26',
    'core-js': '^2.5.4',
    // End Angular Versions
    '@ngrx/effects': '5.2.0',
    '@ngrx/router-store': '5.2.0',
    '@ngrx/store': '5.2.0',
    '@ngrx/store-devtools': '5.2.0',
    '@nrwl/nx': '6.0.1'
  };
  json.devDependencies = {
    ...json.devDependencies,
    // Migrating Angular Dependencies because ng update @angular/core doesn't work well right now
    '@angular/compiler-cli': '6.0.1',
    '@angular/language-service': '6.0.1',
    // End Angular Versions
    '@ngrx/schematics': '5.2.0',
    typescript: '2.7.2',
    'jasmine-marbles': '0.3.1',
    '@types/jasmine': '~2.8.6',
    '@types/jasminewd2': '~2.0.3',
    '@types/node': '~8.9.4',
    codelyzer: '~4.2.1',
    'jasmine-core': '~2.99.1',
    'jasmine-spec-reporter': '~4.2.1',
    karma: '~2.0.0',
    'karma-chrome-launcher': '~2.2.0',
    'karma-coverage-istanbul-reporter': '~1.4.2',
    'karma-jasmine': '~1.1.0',
    'karma-jasmine-html-reporter': '^0.2.2',
    protractor: '~5.3.0',
    'ts-node': '~5.0.1',
    tslint: '~5.9.1',
    prettier: '1.10.2'
  };

  return json;
});

function createDefaultAppTsConfig(host: Tree, project: any) {
  const offset = offsetFromRoot(project.root);

  const defaultAppTsConfig = {
    extends: `${offset}tsconfig.json`,
    compilerOptions: {
      outDir: `${offset}dist/out-tsc/${project.root}`,
      module: 'es2015'
    },
    include: ['**/*.ts'],
    exclude: ['src/test.ts', '**/*.spec.ts']
  };
  createOrUpdate(
    host,
    `${project.root}/tsconfig.app.json`,
    serializeJson(defaultAppTsConfig)
  );
}

function createDefaultE2eTsConfig(host: Tree, project: any) {
  const offset = offsetFromRoot(project.root);

  const defaultE2eTsConfig = {
    extends: `${offset}tsconfig.json`,
    compilerOptions: {
      outDir: `${offset}dist/out-tsc/${project.root}`,
      module: 'commonjs',
      target: 'es5',
      types: ['jasmine', 'jasminewd2', 'node']
    }
  };
  createOrUpdate(
    host,

    `${project.root}/tsconfig.e2e.json`,
    serializeJson(defaultE2eTsConfig)
  );
}

function updateTsConfigs(host: Tree) {
  const angularJson = readJsonInTree(host, 'angular.json');
  Object.entries<any>(angularJson.projects).forEach(([key, project]) => {
    if (
      project.architect.build &&
      project.architect.build.options.main.startsWith('apps')
    ) {
      const offset = offsetFromRoot(project.root);
      const originalTsConfigPath = `${project.root}/src/tsconfig.app.json`;
      if (host.exists(originalTsConfigPath)) {
        const tsConfig = readJsonInTree(host, originalTsConfigPath);
        if (!(tsConfig.exclude as string[]).includes('src/test.ts')) {
          tsConfig.exclude.push('src/test.ts');
        }

        createOrUpdate(
          host,

          `${project.root}/tsconfig.app.json`,
          serializeJson({
            ...tsConfig,
            extends: `${offset}tsconfig.json`,
            compilerOptions: {
              ...tsConfig.compilerOptions,
              outDir: `${offset}dist/out-tsc/${project.root}`
            },
            include: tsConfig.include.map((include: string) => {
              if (include.startsWith('../../../')) {
                include = include.substring(3);
              }

              if (include.includes('/libs/') && include.endsWith('index.ts')) {
                include = include.replace('index.ts', 'src/index.ts');
              }
              return include;
            })
          })
        );
        host.delete(`${project.root}/src/tsconfig.app.json`);
      } else {
        createDefaultAppTsConfig(host, project);
      }
    }

    if (project.architect.e2e) {
      const offset = offsetFromRoot(project.root);

      if (host.exists(`${project.root}/src/tsconfig.e2e.json`)) {
        const tsConfig = readJsonInTree(
          host,
          `${project.root}/src/tsconfig.e2e.json`
        );
        tsConfig.extends = `${offset}tsconfig.json`;
        tsConfig.compilerOptions = {
          ...tsConfig.compilerOptions,
          outDir: `${offset}dist/out-tsc/${project.root}`
        };
        delete tsConfig.include;
        delete tsConfig.exclude;
        createOrUpdate(
          host,

          `${project.root}/tsconfig.e2e.json`,
          serializeJson(tsConfig)
        );
        host.delete(`${project.root}/src/tsconfig.e2e.json`);
      } else {
        createDefaultE2eTsConfig(host, project);
      }
    }
  });
  return host;
}

const updateAngularJson = updateJsonInTree('angular.json', json => {
  json.newProjectRoot = '';
  json.cli = {
    ...json.cli,
    defaultCollection: '@nrwl/schematics'
  };
  delete json.projects.$workspaceRoot;
  delete json.projects['$workspaceRoot-e2e'];
  const prefix = json.schematics['@nrwl/schematics:component'].prefix;
  delete json.schematics;
  json.defaultProject = pathToName(json.defaultProject);

  const projects = {};

  Object.entries<any>(json.projects).forEach(([key, project]) => {
    const type = !project.architect.build
      ? 'e2e'
      : project.architect.build.options.main.startsWith('apps')
        ? 'application'
        : 'library';
    if (type !== 'e2e') {
      project.projectType = type;
    }

    switch (type) {
      case 'application':
        project.root = `apps/${key}`;
        project.sourceRoot = `apps/${key}/src`;
        project.prefix = prefix;

        project.architect.build.options.tsConfig = `${
          project.root
        }/tsconfig.app.json`;
        project.architect.test.options.karmaConfig = `${
          project.root
        }/karma.conf.js`;
        project.architect.test.options.tsConfig = `${
          project.root
        }/tsconfig.spec.json`;

        project.architect.test.options.main = `${project.sourceRoot}/test.ts`;

        project.architect.lint.options.tsConfig = [
          `${project.root}/tsconfig.app.json`,
          `${project.root}/tsconfig.spec.json`
        ];

        project.architect.serve.options.browserTarget = serializeTarget(
          parseAndNormalizeTarget(project.architect.serve.options.browserTarget)
        );
        project.architect.serve.configurations.production.browserTarget = serializeTarget(
          parseAndNormalizeTarget(
            project.architect.serve.configurations.production.browserTarget
          )
        );
        project.architect[
          'extract-i18n'
        ].options.browserTarget = serializeTarget(
          parseAndNormalizeTarget(
            project.architect['extract-i18n'].options.browserTarget
          )
        );
        projects[pathToName(key)] = project;
        break;

      case 'library':
        project.root = `libs/${key}`;
        project.sourceRoot = `libs/${key}/src`;
        project.prefix = prefix;

        project.projectType = 'library';
        project.architect.test.options.karmaConfig = `${
          project.root
        }/karma.conf.js`;
        project.architect.test.options.tsConfig = `${
          project.root
        }/tsconfig.spec.json`;
        project.architect.test.options.main = `${project.sourceRoot}/test.ts`;

        project.architect.lint.options.tsConfig = [
          `${project.root}/tsconfig.lib.json`,
          `${project.root}/tsconfig.spec.json`
        ];
        delete project.architect.build;
        delete project.architect.serve;
        delete project.architect['extract-i18n'];
        projects[pathToName(key)] = project;
        break;

      case 'e2e':
        const appProjectKey = parseTarget(
          project.architect.e2e.options.devServerTarget
        ).project;
        const appProject = json.projects[appProjectKey];
        if (appProject.projectType === 'library') {
          break;
        }
        project.root = `apps/${key}`;
        project.sourceRoot = `apps/${key}/src`;
        project.prefix = prefix;

        project.architect.e2e.options.protractorConfig = `${
          project.root
        }/protractor.conf.js`;
        project.architect.lint.options.tsConfig = [
          `${project.root}/tsconfig.e2e.json`
        ];
        project.architect.e2e.options.devServerTarget = serializeTarget(
          parseAndNormalizeTarget(project.architect.e2e.options.devServerTarget)
        );
        projects[pathToName(key)] = project;
        break;
    }
  });
  json.projects = projects;
  return json;
});

function addTasks(host: Tree, context: SchematicContext) {
  context.addTask(new NodePackageInstallTask());
  context.addTask(new FormatFiles());
}

function checkCli6Upgraded(host: Tree) {
  if (!host.exists('angular.json') && host.exists('.angular-cli.json')) {
    throw new Error(
      'Please install the latest version and run ng update @angular/cli first'
    );
  }
}

function parseAndNormalizeTarget(s: string) {
  const r = parseTarget(s);
  return { ...r, project: pathToName(r.project) };
}

function pathToName(s: string) {
  return s.replace(new RegExp('/', 'g'), '-');
}

function createOrUpdate(host: Tree, path: string, content: string) {
  if (host.exists(path)) {
    host.overwrite(path, content);
  } else {
    host.create(path, content);
  }
}

export default function(): Rule {
  return chain([
    checkCli6Upgraded,
    updatePackageJson,
    updateAngularJson,
    moveE2eTests,
    updateTsConfigs,
    createAdditionalFiles,
    deleteUnneededFiles,
    patchLibIndexFiles,
    addTasks
  ]);
}
