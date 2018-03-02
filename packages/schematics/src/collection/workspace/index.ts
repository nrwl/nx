import { apply, branchAndMerge, chain, mergeWith, Rule, Tree, url } from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as path from 'path';
import { join } from 'path';
import {
  angularCliSchema,
  angularCliVersion,
  latestMigration,
  ngrxVersion,
  nxVersion,
  prettierVersion, routerStoreVersion, schematicsVersion,
} from '../../../../shared/lib-versions';
import * as fs from 'fs';
import { copyFile, serializeJson, updateJsonFile } from '../../../../shared/fileutils';
import { toFileName } from '@nrwl/schematics';

function updatePackageJson() {
  return (host: Tree) => {
    if (!host.exists('package.json')) {
      throw new Error('Cannot find package.json');
    }
    const packageJson = JSON.parse(host.read('package.json')!.toString('utf-8'));
    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
    }
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
    if (!packageJson.devDependencies['@nrwl/schematics']) {
      packageJson.devDependencies['@nrwl/schematics'] = schematicsVersion;
    }
    if (!packageJson.dependencies['@angular/cli']) {
      packageJson.dependencies['@angular/cli'] = angularCliVersion;
    }
    if (!packageJson.devDependencies['prettier']) {
      packageJson.devDependencies['prettier'] = prettierVersion;
    }

    packageJson.scripts['affected:apps'] = './node_modules/.bin/nx affected apps';
    packageJson.scripts['affected:build'] = './node_modules/.bin/nx affected build';
    packageJson.scripts['affected:e2e'] = './node_modules/.bin/nx affected e2e';

    packageJson.scripts['format'] = './node_modules/.bin/nx format write';
    packageJson.scripts['format:write'] = './node_modules/.bin/nx format write';
    packageJson.scripts['format:check'] = './node_modules/.bin/nx format check';

    packageJson.scripts['update'] = './node_modules/.bin/nx update';
    packageJson.scripts['update:check'] = './node_modules/.bin/nx update check';
    packageJson.scripts['update:skip'] = './node_modules/.bin/nx update skip';

    packageJson.scripts['postinstall'] = './node_modules/.bin/nx postinstall';

    host.overwrite('package.json', serializeJson(packageJson));
    return host;
  };
}

function readAngularCliJson(host: Tree): any {
  if (!host.exists('.angular-cli.json')) {
    throw new Error('Cannot find .angular-cli.json');
  }
  return JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
}

function updateAngularCLIJson(options: Schema) {
  return (host: Tree) => {
    const angularCliJson = readAngularCliJson(host);
    angularCliJson.$schema = angularCliSchema;
    angularCliJson.project.npmScope = npmScope(options);
    angularCliJson.project.latestMigration = latestMigration;

    if (angularCliJson.apps.length !== 1) {
      throw new Error('Can only convert projects with one app');
    }

    const app = angularCliJson.apps[0];
    app.name = options.name;
    app.root = path.join('apps', options.name, app.root);
    app.outDir = path.join('dist', 'apps', options.name);
    app.test = '../../../test.js';
    app.testTsconfig = '../../../tsconfig.spec.json';
    app.scripts = app.scripts.map(p => path.join('../../', p));
    if (!angularCliJson.defaults) {
      angularCliJson.defaults = {};
    }
    if (!angularCliJson.defaults.schematics) {
      angularCliJson.defaults.schematics = {};
    }
    angularCliJson.defaults.schematics['collection'] = '@nrwl/schematics';
    angularCliJson.defaults.schematics['postGenerate'] = 'npm run format';
    angularCliJson.defaults.schematics['newProject'] = ['app', 'lib'];

    angularCliJson.lint = [
      {
        project: `${app.root}/tsconfig.app.json`,
        exclude: '**/node_modules/**'
      },
      {
        project: './tsconfig.spec.json',
        exclude: '**/node_modules/**'
      },
      {
        project: `${options.name}/tsconfig.e2e.json`,
        exclude: '**/node_modules/**'
      }
    ];

    host.overwrite('.angular-cli.json', serializeJson(angularCliJson));

    return host;
  };
}

function updateTsConfigsJson(options: Schema) {
  return (host: Tree) => {
    const angularCliJson = readAngularCliJson(host);
    const app = angularCliJson.apps[0];
    updateJsonFile('tsconfig.json', json => setUpCompilerOptions(json, npmScope(options), ''));

    const offset = '../../../';
    updateJsonFile(`${app.root}/tsconfig.app.json`, json => {
      json.extends = `${offset}tsconfig.json`;
      json.compilerOptions.outDir = `${offset}dist/out-tsc/apps/${options.name}`;
      if (!json.exclude) json.exclude = [];
      json.exclude = dedup(json.exclude.concat(['**/*.spec.ts']));

      if (!json.include) json.include = [];
      json.include = dedup(json.include.concat(['**/*.ts']));
    });

    updateJsonFile('tsconfig.spec.json', json => {
      json.extends = './tsconfig.json';
      json.compilerOptions.outDir = `./dist/out-tsc/spec`;

      if (!json.exclude) json.exclude = [];
      json.files = ['test.js'];
      json.include = ['**/*.ts'];
      json.exclude = dedup(
        json.exclude.concat(['**/e2e/*.ts', '**/*.e2e-spec.ts', '**/*.po.ts', 'node_modules', 'tmp'])
      );
    });

    updateJsonFile(`apps/${options.name}/e2e/tsconfig.e2e.json`, json => {
      json.extends = `${offset}tsconfig.json`;
      json.compilerOptions.outDir = `${offset}dist/out-tsc/e2e/${options.name}`;
      if (!json.exclude) json.exclude = [];
      json.exclude = dedup(json.exclude.concat(['**/*.spec.ts']));

      if (!json.include) json.include = [];
      json.include = dedup(json.include.concat(['../**/*.ts']));
    });

    return host;
  };
}

function updateTsLintJson(options: Schema) {
  return (host: Tree) => {
    updateJsonFile('tslint.json', json => {
      ['no-trailing-whitespace', 'one-line', 'quotemark', 'typedef-whitespace', 'whitespace'].forEach(key => {
        json[key] = undefined;
      });
      json.rulesDirectory.push('node_modules/@nrwl/schematics/src/tslint');
      json['nx-enforce-module-boundaries'] = [true, { lazyLoad: [], allow: [] }];
    });
    return host;
  };
}

function npmScope(options: Schema): string {
  return options && options.npmScope ? options.npmScope : options.name;
}

function updateProtractorConf() {
  return (host: Tree) => {
    if (!host.exists('protractor.conf.js')) {
      throw new Error('Cannot find protractor.conf.js');
    }
    const protractorConf = host.read('protractor.conf.js')!.toString('utf-8');
    const updatedConf = protractorConf
      .replace(`'./e2e/**/*.e2e-spec.ts'`, `appDir + ;'/e2e/**/*.e2e-spec.ts'`)
      .replace(`'e2e/tsconfig.e2e.json'`, `appDir + '/e2e/tsconfig.e2e.json'`)
      .replace(
        `exports.config = {`,
        `
const { getAppDirectoryUsingCliConfig } = require('@nrwl/schematics/src/utils/cli-config-utils');
const appDir = getAppDirectoryUsingCliConfig();
exports.config = {
`
      );

    host.overwrite('protractor.conf.js', updatedConf);

    return host;
  };
}

function setUpCompilerOptions(tsconfig: any, npmScope: string, offset: string): void {
  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }
  tsconfig.compilerOptions.baseUrl = '.';
  tsconfig.compilerOptions.paths[`@${npmScope}/*`] = [`${offset}libs/*`];
}

function moveFiles(options: Schema) {
  return (host: Tree) => {
    const angularCliJson = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
    const app = angularCliJson.apps[0];

    fs.mkdirSync('apps');
    fs.mkdirSync('libs');
    fs.unlinkSync(path.join(app.root, app.test));
    fs.mkdirSync(path.join('apps', options.name));
    fs.renameSync(path.join(app.root, app.testTsconfig), 'tsconfig.spec.json');
    fs.renameSync(app.root, join('apps', options.name, app.root));
    fs.renameSync('e2e', join('apps', options.name, 'e2e'));

    return host;
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
    if (!host.exists('protractor.conf.js')) {
      throw new Error('Cannot find protractor.conf.js');
    }
    if (!host.exists('.angular-cli.json')) {
      throw new Error('Cannot find .angular-cli.json');
    }
    const angularCliJson = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
    if (angularCliJson.apps.length !== 1) {
      throw new Error('Can only convert projects with one app');
    }
    return host;
  };
}

export default function(schema: Schema): Rule {
  const options = { ...schema, name: toFileName(schema.name) };
  return chain([
    checkCanConvertToWorkspace(options),
    moveFiles(options),
    branchAndMerge(chain([mergeWith(apply(url('./files'), []))])),
    updatePackageJson(),
    updateAngularCLIJson(options),
    updateTsConfigsJson(options),
    updateProtractorConf(),
    updateTsLintJson(options)
  ]);
}
