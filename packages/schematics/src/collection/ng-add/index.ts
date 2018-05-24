import {
  chain,
  Rule,
  SchematicContext,
  Tree,
  url,
  mergeWith
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as path from 'path';
import { join } from 'path';
import {
  angularCliVersion,
  ngrxStoreFreezeVersion,
  ngrxVersion,
  nxVersion,
  prettierVersion,
  routerStoreVersion,
  schematicsVersion,
  jasmineMarblesVersion,
  ngrxSchematicsVersion
} from '../../lib-versions';
import * as fs from 'fs';
import {
  offsetFromRoot,
  resolveUserExistingPrettierConfig,
  DEFAULT_NRWL_PRETTIER_CONFIG
} from '../../utils/common';
import { updateJsonFile, serializeJson } from '../../utils/fileutils';
import { toFileName } from '../../utils/name-utils';
import { updateJsonInTree, readJsonInTree } from '../../utils/ast-utils';
import {
  parseTarget,
  serializeTarget,
  editTarget
} from '../../utils/cli-config-utils';
import { from } from 'rxjs';
import { tap, mapTo } from 'rxjs/operators';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

function updatePackageJson() {
  return updateJsonInTree('package.json', packageJson => {
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts = {
      ...packageJson.scripts,
      'affected:apps': './node_modules/.bin/nx affected:apps',
      'affected:build': './node_modules/.bin/nx affected:build',
      'affected:e2e': './node_modules/.bin/nx affected:e2e',
      'affected:test': './node_modules/.bin/nx affected:test',
      'affected:dep-graph': './node_modules/.bin/nx affected:dep-graph',
      format: './node_modules/.bin/nx format:write',
      'format:write': './node_modules/.bin/nx format:write',
      'format:check': './node_modules/.bin/nx format:check',
      update: './node_modules/.bin/nx update',
      'update:check': './node_modules/.bin/nx update:check',
      'update:skip': './node_modules/.bin/nx update:skip',
      lint: './node_modules/.bin/nx lint && ng lint',
      'dep-graph': './node_modules/.bin/nx dep-graph',
      'workspace-schematic': './node_modules/.bin/nx workspace-schematic',
      help: './node_modules/.bin/nx help'
    };
    packageJson.devDependencies = packageJson.devDependencies || {};
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    if (!packageJson.dependencies['@nrwl/nx']) {
      packageJson.dependencies['@nrwl/nx'] = nxVersion;
    }
    if (!packageJson.dependencies['@ngrx/store']) {
      packageJson.dependencies['@ngrx/store'] = ngrxVersion;
    }
    if (!packageJson.dependencies['@ngrx/router-store']) {
      packageJson.dependencies['@ngrx/router-store'] = routerStoreVersion;
    }
    if (!packageJson.dependencies['@ngrx/effects']) {
      packageJson.dependencies['@ngrx/effects'] = ngrxVersion;
    }
    if (!packageJson.dependencies['@ngrx/store-devtools']) {
      packageJson.dependencies['@ngrx/store-devtools'] = ngrxVersion;
    }
    if (!packageJson.dependencies['ngrx-store-freeze']) {
      packageJson.dependencies['ngrx-store-freeze'] = ngrxStoreFreezeVersion;
    }
    if (!packageJson.devDependencies['@ngrx/schematics']) {
      packageJson.devDependencies['@ngrx/schematics'] = ngrxSchematicsVersion;
    }
    if (!packageJson.devDependencies['@nrwl/schematics']) {
      packageJson.devDependencies['@nrwl/schematics'] = schematicsVersion;
    }
    if (!packageJson.devDependencies['@angular/cli']) {
      packageJson.devDependencies['@angular/cli'] = angularCliVersion;
    }
    packageJson.devDependencies['karma'] = '~2.0.0';
    if (!packageJson.devDependencies['jasmine-marbles']) {
      packageJson.devDependencies['jasmine-marbles'] = jasmineMarblesVersion;
    }
    if (!packageJson.devDependencies['prettier']) {
      packageJson.devDependencies['prettier'] = prettierVersion;
    }

    return packageJson;
  });
}

function convertPath(name: string, originalPath: string) {
  return `apps/${name}/${originalPath}`;
}

function updateAngularCLIJson(options: Schema): Rule {
  return updateJsonInTree('angular.json', angularJson => {
    angularJson = {
      ...angularJson,
      newProjectRoot: '',
      cli: {
        defaultCollection: '@nrwl/schematics'
      }
    };

    let app = angularJson.projects[options.name];
    let e2eProject = angularJson.projects[`${options.name}-e2e`];

    const oldSourceRoot = app.sourceRoot;

    app = {
      ...app,
      root: path.join('apps', options.name),
      sourceRoot: convertPath(options.name, app.sourceRoot)
    };
    e2eProject.root = path.join('apps', options.name + '-e2e');

    const buildConfig = app.architect.build;

    buildConfig.options = {
      ...buildConfig.options,
      outputPath: path.join('dist/apps', options.name),
      index: convertPath(options.name, buildConfig.options.index),
      main: convertPath(options.name, buildConfig.options.main),
      polyfills: convertPath(options.name, buildConfig.options.polyfills),
      tsConfig: path.join(app.root, getFilename(buildConfig.options.tsConfig)),
      assets: buildConfig.options.assets.map(
        asset =>
          asset.startsWith(oldSourceRoot)
            ? convertPath(options.name, asset)
            : asset
      ),
      styles: buildConfig.options.styles.map(
        style =>
          style.startsWith(oldSourceRoot)
            ? convertPath(options.name, style)
            : style
      ),
      scripts: buildConfig.options.scripts.map(
        script =>
          script.startsWith(oldSourceRoot)
            ? convertPath(options.name, script)
            : script
      )
    };

    buildConfig.configurations.production.fileReplacements = buildConfig.configurations.production.fileReplacements.map(
      replacement => {
        return {
          replace: convertPath(options.name, replacement.replace),
          with: convertPath(options.name, replacement.with)
        };
      }
    );

    const serveConfig = app.architect.serve;

    serveConfig.options.browserTarget = editTarget(
      serveConfig.options.browserTarget,
      parsedTarget => {
        return {
          ...parsedTarget,
          project: options.name
        };
      }
    );

    serveConfig.configurations.production.browserTarget = editTarget(
      serveConfig.configurations.production.browserTarget,
      parsedTarget => {
        return {
          ...parsedTarget,
          project: options.name
        };
      }
    );

    const i18nConfig = app.architect['extract-i18n'];

    i18nConfig.options.browserTarget = editTarget(
      i18nConfig.options.browserTarget,
      parsedTarget => {
        return {
          ...parsedTarget,
          project: options.name
        };
      }
    );

    const testConfig = app.architect.test;

    testConfig.options = {
      ...testConfig.options,
      main: convertPath(options.name, testConfig.options.main),
      polyfills: convertPath(options.name, testConfig.options.polyfills),
      tsConfig: path.join(app.root, getFilename(testConfig.options.tsConfig)),
      karmaConfig: path.join(
        app.root,
        getFilename(testConfig.options.karmaConfig)
      ),
      assets: testConfig.options.assets.map(
        asset =>
          asset.startsWith(oldSourceRoot)
            ? convertPath(options.name, asset)
            : asset
      ),
      styles: testConfig.options.styles.map(
        style =>
          style.startsWith(oldSourceRoot)
            ? convertPath(options.name, style)
            : style
      ),
      scripts: testConfig.options.scripts.map(
        script =>
          script.startsWith(oldSourceRoot)
            ? convertPath(options.name, script)
            : script
      )
    };

    const lintConfig = app.architect.lint;
    lintConfig.options = {
      ...lintConfig.options,
      tsConfig: [buildConfig.options.tsConfig, testConfig.options.tsConfig]
    };

    const e2eConfig = e2eProject.architect.e2e;
    e2eConfig.options = {
      ...e2eConfig.options,
      protractorConfig: path.join(
        e2eProject.root,
        getFilename(e2eConfig.options.protractorConfig)
      )
    };

    e2eConfig.options.devServerTarget = editTarget(
      e2eConfig.options.devServerTarget,
      parsedTarget => {
        return {
          ...parsedTarget,
          project: options.name
        };
      }
    );

    const e2eLintConfig = e2eProject.architect.lint;
    e2eLintConfig.options.tsConfig = path.join(
      e2eProject.root,
      getFilename(e2eLintConfig.options.tsConfig)
    );

    angularJson.projects[options.name] = app;
    angularJson.projects[`${options.name}-e2e`] = e2eProject;

    return angularJson;
  });
}

function updateTsConfig(options: Schema): Rule {
  return updateJsonInTree('tsconfig.json', tsConfigJson =>
    setUpCompilerOptions(tsConfigJson, options.npmScope, '')
  );
}

function updateTsConfigsJson(options: Schema) {
  return (host: Tree) => {
    const angularJson = readJsonInTree(host, 'angular.json');
    const app = angularJson.projects[options.name];
    const e2eProject = angularJson.projects[`${options.name}-e2e`];

    // This has to stay using fs since it is created with fs
    const offset = '../../';
    updateJsonFile(`${app.root}/tsconfig.app.json`, json => {
      json.extends = `${offset}tsconfig.json`;
      json.compilerOptions.outDir = `${offset}dist/out-tsc/apps/${
        options.name
      }`;
    });

    // This has to stay using fs since it is created with fs
    updateJsonFile(`${app.root}/tsconfig.spec.json`, json => {
      json.extends = `${offset}tsconfig.json`;
      json.compilerOptions.outDir = `${offset}dist/out-tsc/apps/${
        options.name
      }`;
      if (json.files) {
        json.files = json.files.map(file =>
          path.join(path.relative(app.root, app.sourceRoot), file)
        );
      }
    });

    // This has to stay using fs since it is created with fs
    updateJsonFile(`${e2eProject.root}/tsconfig.e2e.json`, json => {
      json.extends = `${offsetFromRoot(e2eProject.root)}tsconfig.json`;
      json.compilerOptions = {
        ...json.compilerOptions,
        outDir: `${offsetFromRoot(e2eProject.root)}dist/out-tsc/${
          e2eProject.root
        }`
      };
    });

    return host;
  };
}

function updateTsLint() {
  return updateJsonInTree('tslint.json', tslintJson => {
    [
      'no-trailing-whitespace',
      'one-line',
      'quotemark',
      'typedef-whitespace',
      'whitespace'
    ].forEach(key => {
      tslintJson[key] = undefined;
    });
    tslintJson.rulesDirectory = tslintJson.rulesDirectory || [];
    tslintJson.rulesDirectory.push('node_modules/@nrwl/schematics/src/tslint');
    tslintJson['nx-enforce-module-boundaries'] = [
      true,
      {
        allow: [],
        depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]
      }
    ];
    return tslintJson;
  });
}

function updateProjectTsLint(options: Schema) {
  return (host: Tree) => {
    const angularJson = readJsonInTree(host, '/angular.json');
    const app = angularJson.projects[options.name];
    const offset = '../../';

    updateJsonFile(`${app.root}/tslint.json`, json => {
      json.extends = `${offset}tslint.json`;
    });

    return host;
  };
}

function setUpCompilerOptions(
  tsconfig: any,
  npmScope: string,
  offset: string
): any {
  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }
  tsconfig.compilerOptions.baseUrl = '.';
  tsconfig.compilerOptions.paths[`@${npmScope}/*`] = [`${offset}libs/*`];

  return tsconfig;
}

function moveOutOfSrc(sourceRoot: string, appName: string, filename: string) {
  fs.renameSync(
    path.join(sourceRoot, filename),
    path.join('apps', appName, filename)
  );
}

function getFilename(path: string) {
  return path.split('/').pop();
}

function moveExistingFiles(options: Schema) {
  return (host: Tree) => {
    const angularJson = readJsonInTree(host, 'angular.json');
    const app = angularJson.projects[options.name];

    fs.mkdirSync('apps');
    fs.mkdirSync(path.join('apps', options.name));
    moveOutOfSrc(app.sourceRoot, options.name, 'browserslist');
    moveOutOfSrc(
      app.sourceRoot,
      options.name,
      getFilename(app.architect.test.options.karmaConfig)
    );
    moveOutOfSrc(
      app.sourceRoot,
      options.name,
      getFilename(app.architect.build.options.tsConfig)
    );
    moveOutOfSrc(
      app.sourceRoot,
      options.name,
      getFilename(app.architect.test.options.tsConfig)
    );
    moveOutOfSrc(app.sourceRoot, options.name, 'tslint.json');
    fs.renameSync(app.sourceRoot, join('apps', options.name, app.sourceRoot));
    fs.renameSync('e2e', join('apps', options.name + '-e2e'));

    return host;
  };
}

function createAdditionalFiles(options: Schema): Rule {
  return (host: Tree, _context: SchematicContext) => {
    host.create(
      'nx.json',
      serializeJson({
        npmScope: options.npmScope,
        projects: {
          [options.name]: {
            tags: []
          },
          [`${options.name}-e2e`]: {
            tags: []
          }
        }
      })
    );
    host.create('libs/.gitkeep', '');

    // if the user does not already have a prettier configuration
    // of any kind, create one
    return from(resolveUserExistingPrettierConfig()).pipe(
      tap(existingPrettierConfig => {
        if (!existingPrettierConfig) {
          host.create(
            '.prettierrc',
            serializeJson(DEFAULT_NRWL_PRETTIER_CONFIG)
          );
        }
      }),
      mapTo(host)
    );
  };
}

function dedup(array: any[]): any[] {
  const res = [];

  array.forEach(a => {
    if (res.indexOf(a) === -1) {
      res.push(a);
    }
  });
  return res;
}

function checkCanConvertToWorkspace(options: Schema) {
  return (host: Tree) => {
    if (!host.exists('package.json')) {
      throw new Error('Cannot find package.json');
    }
    if (!host.exists('e2e/protractor.conf.js')) {
      throw new Error('Cannot find e2e/protractor.conf.js');
    }

    // TODO: This restriction should be lited
    const angularJson = readJsonInTree(host, 'angular.json');
    if (Object.keys(angularJson.projects).length > 2) {
      throw new Error('Can only convert projects with one app');
    }
    return host;
  };
}

function addInstallTask(options: Schema) {
  return (host: Tree, context: SchematicContext) => {
    if (!options.skipInstall) {
      context.addTask(new NodePackageInstallTask());
    }
    return host;
  };
}

export default function(schema: Schema): Rule {
  const options = {
    ...schema,
    name: toFileName(schema.name),
    npmScope: toFileName(schema.npmScope || schema.name)
  };
  return chain([
    checkCanConvertToWorkspace(options),
    mergeWith(url('./files')),
    moveExistingFiles(options),
    createAdditionalFiles(options),
    updatePackageJson(),
    updateAngularCLIJson(options),
    updateTsLint(),
    updateProjectTsLint(options),
    updateTsConfig(options),
    updateTsConfigsJson(options),
    addInstallTask(options)
  ]);
}
