import {apply, branchAndMerge, chain, externalSchematic, mergeWith, move, Rule, template, Tree, url, schematic} from '@angular-devkit/schematics';
import {Schema} from './schema';
import {names, toFileName} from '@nrwl/schematics';
import * as path from 'path';
import {ngrxVersion, nxVersion, schematicsVersion} from '../utility/lib-versions';
import * as fs from 'fs';
import {join} from 'path';
import {updateJsonFile} from '../utility/fileutils';

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
    if (!packageJson.dependencies['@nrwl/nx']) {
      packageJson.dependencies['@nrwl/nx'] = nxVersion;
    }
    if (!packageJson.dependencies['@ngrx/store']) {
      packageJson.dependencies['@ngrx/store'] = ngrxVersion;
    }
    if (!packageJson.dependencies['@ngrx/router-store']) {
      packageJson.dependencies['@ngrx/router-store'] = ngrxVersion;
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
    host.overwrite('package.json', JSON.stringify(packageJson, null, 2));
    return host;
  };
}

function updateAngularCLIJson(options: Schema) {
  return (host: Tree) => {
    if (!host.exists('.angular-cli.json')) {
      throw new Error('Cannot find .angular-cli.json');
    }
    const angularCliJson = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
    if (angularCliJson.apps.length !== 1) {
      throw new Error('Can only convert projects with one app');
    }

    angularCliJson.lint =
        [{'project': './tsconfig.app.json'}, {'project': './tsconfig.spec.json'}, {'project': './tsconfig.e2e.json'}];

    const app = angularCliJson.apps[0];
    app.root = path.join('apps', options.name, app.root);
    app.outDir = path.join('dist', 'apps', options.name);
    app.test = '../../../test.js';
    app.tsconfig = '../../../tsconfig.app.json';
    app.testTsconfig = '../../../tsconfig.spec.json';
    app.scripts = app.scripts.map((p) => path.join('../../', p));
    if (!angularCliJson.defaults) {
      angularCliJson.defaults = {};
    }
    if (!angularCliJson.defaults.schematics) {
      angularCliJson.defaults.schematics = {};
    }
    angularCliJson.defaults.schematics['collection'] = '@nrwl/schematics';
    angularCliJson.defaults.schematics['newProject'] = ['app', 'lib'];

    host.overwrite('.angular-cli.json', JSON.stringify(angularCliJson, null, 2));

    return host;
  };
}

function updateTsConfigsJson(options: Schema) {
  return (host: Tree) => {
    const angularCliJson = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
    const npmScope = options && options.npmScope ? options.npmScope : options.name;

    updateJsonFile('tsconfig.json', (json) => setUpCompilerOptions(json, npmScope));

    updateJsonFile('tsconfig.app.json', (json) => {
      json['extends'] = './tsconfig.json';
      if (!json.exclude) json.exclude = [];
      json.exclude = dedup(json.exclude.concat(['**/*.spec.ts', '**/*.e2e-spec.ts', 'node_modules', 'tmp']));
      setUpCompilerOptions(json, npmScope);
    });

    updateJsonFile('tsconfig.spec.json', (json) => {
      json['extends'] = './tsconfig.json';
      if (!json.exclude) json.exclude = [];
      json.files = ['test.js'];
      json.exclude = dedup(json.exclude.concat(['node_modules', 'tmp']));
      setUpCompilerOptions(json, npmScope);
    });

    updateJsonFile('tsconfig.e2e.json', (json) => {
      json['extends'] = './tsconfig.json';
      if (!json.exclude) json.exclude = [];
      json.exclude = dedup(json.exclude.concat(['**/*.spec.ts', 'node_modules', 'tmp']));
      setUpCompilerOptions(json, npmScope);
    });

    return host;
  };
}

function updateProtractorConf() {
  return (host: Tree) => {
    if (!host.exists('protractor.conf.js')) {
      throw new Error('Cannot find protractor.conf.js');
    }
    const protractorConf = host.read('protractor.conf.js')!.toString('utf-8');
    const updatedConf = protractorConf.replace(`./e2e/**/*.e2e-spec.ts`, `./apps/**/*.e2e-spec.ts`)
                            .replace(`e2e/tsconfig.e2e.json`, `./tsconfig.e2e.json`);

    host.overwrite('protractor.conf.js', updatedConf);

    return host;
  };
}

function setUpCompilerOptions(tsconfig: any, npmScope: string): void {
  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }
  tsconfig.compilerOptions.baseUrl = '.';
  tsconfig.compilerOptions.paths[`@${npmScope}/*`] = ['libs/*'];
}

function moveFiles(options: Schema) {
  return (host: Tree) => {
    const angularCliJson = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));
    const app = angularCliJson.apps[0];

    fs.mkdirSync('apps');
    fs.mkdirSync('libs');
    fs.unlinkSync(path.join(app.root, app.test));
    fs.mkdirSync(path.join('apps', options.name));
    fs.renameSync(path.join(app.root, app.tsconfig), 'tsconfig.app.json');
    fs.renameSync(path.join(app.root, app.testTsconfig), 'tsconfig.spec.json');
    fs.renameSync(path.join('e2e', 'tsconfig.e2e.json'), 'tsconfig.e2e.json');
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

export default function(options: Schema): Rule {
  return chain([
    moveFiles(options), branchAndMerge(chain([
      mergeWith(apply(url('./files'), [])),
    ])),
    updatePackageJson(), updateAngularCLIJson(options), updateTsConfigsJson(options), updateProtractorConf()
  ]);
}
