import {
  Rule,
  SchematicContext,
  Tree,
  chain
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

import {
  updateJsonInTree,
  readJsonInTree,
  getProjectConfig
} from '../../src/utils/ast-utils';
import { FormatFiles } from '../../src/utils/tasks';
import { serializeJson } from '../../src/utils/fileutils';
import { getSourceNodes } from '@schematics/angular/utility/ast-utils';
import {
  ngrxSchematicsVersion,
  ngrxVersion,
  angularVersion,
  rxjsVersion
} from '../../src/lib-versions';
import { parseTarget } from '../../src/utils/cli-config-utils';
import {
  findFunctionCallExpressionStatement,
  findRequireStatement,
  findFunctionCalls,
  findSpecDeclaration,
  findTsNodeRegisterExpression
} from './helpers';

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

function updateKarmaConfigs(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');

  const karmaPath =
    angularJson.projects[angularJson.defaultProject].architect.test.options
      .karmaConfig;
  const contents = host.read(karmaPath).toString();
  let newContents = contents;
  const sourceFile = ts.createSourceFile(
    karmaPath,
    contents,
    ts.ScriptTarget.Latest
  );

  const nodes = getSourceNodes(sourceFile);
  const functionCall = findFunctionCallExpressionStatement(
    nodes,
    'makeSureNoAppIsSelected'
  );

  if (functionCall) {
    const hasComment = functionCall
      .getFullText(sourceFile)
      .includes(
        '// Nx only supports running unit tests for all apps and libs.'
      );

    const text = hasComment
      ? functionCall.getFullText(sourceFile)
      : functionCall.getText(sourceFile);

    newContents = newContents.replace(text, '');

    const requireStatement = findRequireStatement(nodes);

    if (requireStatement) {
      newContents = newContents.replace(
        requireStatement.getText(sourceFile),
        ''
      );
    }
  }
  host.delete(karmaPath);

  Object.entries<any>(angularJson.projects)
    .filter(
      ([key, project]) => project.architect.test && key !== '$workspaceRoot'
    )
    .forEach(([key, project]) => {
      const projectRoot = project.architect.build.options.main.startsWith(
        'apps'
      )
        ? 'apps'
        : 'libs';
      host.create(`${projectRoot}/${key}/karma.conf.js`, newContents);
    });

  return host;
}

// Todo we have to fix specs
function updateProtractorConfigs(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');

  const protractorPath = getProjectConfig(
    host,
    angularJson.defaultProject + '-e2e'
  ).architect.e2e.options.protractorConfig;
  const contents = host.read(protractorPath).toString();
  let newContents = contents;
  const sourceFile = ts.createSourceFile(
    protractorPath,
    contents,
    ts.ScriptTarget.Latest
  );

  const nodes = getSourceNodes(sourceFile);
  const functionCalls = findFunctionCalls(
    sourceFile,
    'getAppDirectoryUsingCliConfig'
  );

  functionCalls.forEach(statement => {
    if (statement.declarationList.declarations.length === 1) {
      newContents = newContents.replace(statement.getText(sourceFile), '');
    } else {
      statement.declarationList.declarations.forEach(declaration => {
        if (
          ts.isCallExpression(declaration.initializer) &&
          ts.isIdentifier(declaration.initializer.expression) &&
          declaration.initializer.expression.text ===
            'getAppDirectoryUsingCliConfig'
        ) {
          // Remove the full text (includes trailing whitespace) up to the next comma
          const regex = new RegExp(
            declaration.getFullText(sourceFile).replace('()', '\\(\\)') +
              '\\s*,?'
          );
          newContents = newContents.replace(regex, '');
        }
      });
    }
  });
  const requireStatement = findRequireStatement(nodes);

  if (requireStatement) {
    newContents = newContents.replace(requireStatement.getText(sourceFile), '');
  }

  const specDeclaration = findSpecDeclaration(nodes);
  if (specDeclaration) {
    newContents = newContents.replace(
      specDeclaration.initializer.getText(sourceFile),
      `['./**/*.e2e-spec.ts']`
    );
  }

  const tsNodeRegisterExpression = findTsNodeRegisterExpression(nodes);
  if (tsNodeRegisterExpression) {
    if (!ts.isObjectLiteralExpression(tsNodeRegisterExpression.arguments[0])) {
      console.warn('');
    } else {
      const objectLiteral = tsNodeRegisterExpression
        .arguments[0] as ts.ObjectLiteralExpression;
      const projectProperty = objectLiteral.properties.find(
        property =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'project'
      ) as ts.PropertyAssignment;
      if (projectProperty) {
        newContents = newContents.replace(
          projectProperty.initializer.getText(sourceFile),
          `require('path').join(__dirname, './tsconfig.e2e.json')`
        );
      }
    }
  }

  host.delete(protractorPath);

  Object.entries<any>(angularJson.projects)
    .filter(([key, project]) => {
      if (!project.architect.e2e || key === '$workspaceRoot-e2e') {
        return false;
      }

      const srcProjectKey = parseTarget(
        project.architect.e2e.options.devServerTarget
      ).project;

      const srcProject = getProjectConfig(host, srcProjectKey);

      return srcProject.architect.build.options.main.startsWith('apps');
    })
    .forEach(([key, project]) => {
      host.create(`apps/${key}/protractor.conf.js`, newContents);
    });

  return host;
}

function createTestTs(host: Tree, project: any) {
  host.create(
    `${project.sourceRoot}/test.ts`,
    stripIndents`
      // This file is required by karma.conf.js and loads recursively all the .spec and framework files

      ${
        project.projectType === 'library'
          ? stripIndents`
            import 'core-js/es7/reflect';
            import 'zone.js/dist/zone';`
          : ''
      }
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

function createBrowserlist(host: Tree, path: string) {
  host.create(
    path,
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

function createTsconfigSpecJson(host: Tree, project: any, projectKey: string) {
  const files = ['src/test.ts'];
  if (project.projectType === 'application') {
    files.push('src/polyfills.ts');
  }
  host.create(
    `${project.root}/tsconfig.spec.json`,
    serializeJson({
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: `../../dist/out-tsc/apps/${projectKey}`,
        module: 'commonjs',
        types: ['jasmine', 'node']
      },
      files,
      include: ['**/*.spec.ts', '**/*.d.ts']
    })
  );
}

function createTslintJson(host: Tree, path: string, prefix: string) {
  host.create(
    path,
    serializeJson({
      extends: '../../tslint.json',
      rules: {
        'directive-selector': [true, 'attribute', prefix, 'camelCase'],
        'component-selector': [true, 'element', prefix, 'kebab-case']
      }
    })
  );
}

function createTsconfigLibJson(host: Tree, path: string, projectKey: string) {
  host.create(
    path,
    serializeJson({
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: `../../out-tsc/${projectKey}`,
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

function createAdditionalFiles(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');
  Object.entries<any>(angularJson.projects).forEach(([key, project]) => {
    if (project.architect.test) {
      createTsconfigSpecJson(host, project, key);
      createTestTs(host, project);
    }

    if (project.projectType === 'application' && !project.architect.e2e) {
      createBrowserlist(host, `${project.root}/browserslist`);
    }
    if (project.projectType === 'library') {
      createTsconfigLibJson(
        host,
        `${project.root}/tsconfig.lib.json`,
        project.key
      );
    }
    if (!project.architect.e2e) {
      createTslintJson(host, `${project.root}/tslint.json`, project.prefix);
    }
  });
  return host;
}

function moveFiles(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');
  Object.entries<any>(angularJson.projects)
    .filter(([key, project]) => {
      if (!project.architect.e2e || key === '$workspaceRoot-e2e') {
        return false;
      }

      const srcProjectKey = parseTarget(
        project.architect.e2e.options.devServerTarget
      ).project;

      const srcProject = getProjectConfig(host, srcProjectKey);

      return srcProject.architect.build.options.main.startsWith('apps');
    })
    .forEach(([key, project]) => {
      fs.mkdirSync(`apps/${key}`);
      fs.renameSync(`apps/${key.replace('-e2e', '')}/e2e`, `apps/${key}/src`);
    });
  return host;
}

function deleteUnneededFiles(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');
  const defaultProject = getProjectConfig(host, angularJson.defaultProject);
  host.delete(defaultProject.architect.test.options.main);
  host.delete(defaultProject.architect.test.options.tsConfig);
}

const updatePackageJson = updateJsonInTree('package.json', json => {
  json.dependencies = json.dependencies || {};
  json.devDependencies = json.devDependencies || {};

  json.dependencies = {
    ...json.dependencies,
    // Migrating Angular Dependencies because ng update @angular/core doesn't work well right now
    '@angular/common': angularVersion,
    '@angular/compiler': angularVersion,
    '@angular/core': angularVersion,
    '@angular/forms': angularVersion,
    '@angular/platform-browser': angularVersion,
    '@angular/platform-browser-dynamic': angularVersion,
    '@angular/router': angularVersion,
    rxjs: rxjsVersion,
    'rxjs-compat': rxjsVersion,
    'zone.js': '^0.8.26',
    // End Angular Versions
    '@ngrx/effects': ngrxVersion,
    '@ngrx/router-store': ngrxVersion,
    '@ngrx/store': ngrxVersion,
    '@ngrx/store-devtools': ngrxVersion
  };
  json.devDependencies = {
    ...json.devDependencies,
    // Migrating Angular Dependencies because ng update @angular/core doesn't work well right now
    '@angular/compiler-cli': angularVersion,
    '@angular/language-service': angularVersion,
    // End Angular Versions
    '@ngrx/schematics': ngrxSchematicsVersion,
    typescript: '~2.7.2'
  };

  json.scripts.postinstall = './node_modules/.bin/nx postinstall';

  return json;
});

function createDefaultAppTsConfig(host: Tree, projectName: string) {
  const defaultAppTsConfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: '../../../dist/out-tsc/apps/' + projectName,
      module: 'es2015'
    },
    include: ['**/*.ts'],
    exclude: ['**/*.spec.ts']
  };
  host.create(
    `apps/${projectName}/tsconfig.app.json`,
    serializeJson(defaultAppTsConfig)
  );
}

function createDefaultE2eTsConfig(host: Tree, projectName: string) {
  const defaultE2eTsConfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc/apps/' + projectName,
      module: 'commonjs',
      target: 'es5',
      types: ['jasmine', 'jasminewd2', 'node']
    }
  };
  host.create(
    `apps/${projectName}/tsconfig.e2e.json`,
    serializeJson(defaultE2eTsConfig)
  );
}

function updateTsConfigs(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');
  Object.entries<any>(angularJson.projects).forEach(([key, project]) => {
    if (
      project.architect.build &&
      project.architect.build.options.main.startsWith('apps')
    ) {
      if (host.exists(project.architect.build.options.tsConfig)) {
        const tsConfig = readJsonInTree(
          host,
          project.architect.build.options.tsConfig
        );
        host.create(
          `apps/${key}/tsconfig.app.json`,
          serializeJson({
            ...tsConfig,
            extends: '../../tsconfig.json',
            compilerOptions: {
              ...tsConfig.compilerOptions,
              outDir: '../../dist/out-tsc/apps/' + key
            },
            include: tsConfig.include.map((path: string) => {
              if (path.startsWith('../../../')) {
                return path.substring(3);
              } else {
                return path;
              }
            })
          })
        );
        host.delete(project.architect.build.options.tsConfig);
      } else {
        createDefaultAppTsConfig(host, key);
      }
    }

    if (!project.architect.e2e || key === '$workspaceRoot-e2e') {
      return;
    }

    const srcProjectKey = parseTarget(
      project.architect.e2e.options.devServerTarget
    ).project;

    const srcProject = getProjectConfig(host, srcProjectKey);

    if (srcProject.architect.build.options.main.startsWith('apps')) {
      if (host.exists(`apps/${key}/src/tsconfig.e2e.json`)) {
        const tsConfig = readJsonInTree(
          host,
          `apps/${key}/src/tsconfig.e2e.json`
        );
        tsConfig.extends = '../../tsconfig.json';
        tsConfig.compilerOptions = {
          ...tsConfig.compilerOptions,
          outDir: '../../dist/out-tsc/apps/' + key
        };
        delete tsConfig.include;
        delete tsConfig.exclude;
        host.create(`apps/${key}/tsconfig.e2e.json`, serializeJson(tsConfig));
        host.delete(`apps/${key}/src/tsconfig.e2e.json`);
      } else {
        createDefaultE2eTsConfig(host, key);
      }
    }
  });
  return host;
}

function updateNxJson(host: Tree, context: SchematicContext) {
  const angularJson = readJsonInTree(host, 'angular.json');
  return updateJsonInTree('nx.json', json => {
    Object.entries<any>(angularJson.projects).forEach(([key, project]) => {
      if (project.architect.e2e) {
        json.projects[key] = {
          tags: []
        };
      }
    });
    return json;
  })(host, context);
}

const updateAngularJson = updateJsonInTree('angular.json', json => {
  json.newProjectRoot = '';
  json.cli = {
    ...json.cli,
    defaultCollection: '@nrwl/schematics'
  };
  delete json.projects.$workspaceRoot;
  delete json.projects['$workspaceRoot-e2e'];
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
        break;

      case 'library':
        project.root = `libs/${key}`;
        project.sourceRoot = `libs/${key}/src`;
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
        break;
      case 'e2e':
        const appProjectKey = parseTarget(
          project.architect.e2e.options.devServerTarget
        ).project;
        const appProject = json.projects[appProjectKey];
        if (appProject.projectType === 'library') {
          delete json.projects[key];
          break;
        }
        project.root = `apps/${key}`;
        project.sourceRoot = `apps/${key}/src`;

        project.architect.e2e.options.protractorConfig = `${
          project.root
        }/protractor.conf.js`;
        project.architect.lint.options.tsConfig = [
          `${project.root}/tsconfig.e2e.json`
        ];
        break;
    }
  });
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

export default (options: any): Rule => {
  return chain([
    checkCli6Upgraded,
    updatePackageJson,
    moveFiles,
    updateKarmaConfigs,
    updateProtractorConfigs,
    deleteUnneededFiles,
    updateTsConfigs,
    updateAngularJson,
    updateNxJson,
    createAdditionalFiles,
    addTasks
  ]);
};
