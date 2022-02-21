process.env.SELECTED_CLI = 'angular';

import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  readJson,
  runCLI,
  runCommand,
  runNgAdd,
  runNgNew,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { PackageManager } from '@nrwl/tao/src/shared/package-manager';

describe('convert Angular CLI workspace to an Nx workspace', () => {
  let project: string;
  let packageManager: PackageManager;

  // utility to manually add protractor since it's not generated
  // in the latest Angular CLI versions, but older projects updated
  // to latest versions might still have it
  function addProtractor() {
    updateFile('e2e/protractor.conf.js', 'exports.config = {};');
    updateFile(
      'e2e/tsconfig.json',
      JSON.stringify({ extends: '../tsconfig.json' }, null, 2)
    );
    updateFile(
      'e2e/src/app.e2e-spec.ts',
      `describe('app', () => {
        it('should pass', {
          expect(true).toBe(true);
        });
      });`
    );

    const angularJson = readJson('angular.json');
    angularJson.projects[project].architect.e2e = {
      builder: '@angular-devkit/build-angular:protractor',
      options: {
        protractorConfig: 'e2e/protractor.conf.js',
        devServerTarget: `${project}:serve`,
      },
      configurations: {
        production: { devServerTarget: `${project}:serve:production` },
      },
    };
    updateFile('angular.json', JSON.stringify(angularJson, null, 2));
  }

  beforeEach(() => {
    project = uniq('proj');
    packageManager = getSelectedPackageManager();
    // TODO: solve issues with pnpm and remove this fallback
    packageManager = packageManager === 'pnpm' ? 'yarn' : packageManager;
    runNgNew(project, packageManager);
  });

  afterEach(() => {
    cleanupProject();
  });

  it('should generate a workspace', () => {
    addProtractor();

    // update package.json
    const packageJson = readJson('package.json');
    packageJson.description = 'some description';
    updateFile('package.json', JSON.stringify(packageJson, null, 2));

    // update tsconfig.json
    const tsConfig = readJson('tsconfig.json');
    tsConfig.compilerOptions.paths = { a: ['b'] };
    updateFile('tsconfig.json', JSON.stringify(tsConfig, null, 2));

    // add an extra script file
    updateFile('src/scripts.ts', 'const x = 1;');

    // update angular.json
    const angularJson = readJson('angular.json');
    angularJson.projects[project].architect.build.options.scripts =
      angularJson.projects[project].architect.test.options.scripts = [
        'src/scripts.ts',
      ];
    angularJson.projects[project].architect.test.options.styles = [
      'src/styles.css',
    ];
    updateFile('angular.json', JSON.stringify(angularJson, null, 2));

    // confirm that @nrwl dependencies do not exist yet
    expect(packageJson.devDependencies['@nrwl/workspace']).not.toBeDefined();

    // run ng add
    runNgAdd('--npm-scope projscope');

    // check that prettier config exits and that files have been moved
    checkFilesExist(
      '.vscode/extensions.json',
      '.prettierrc',
      `apps/${project}/src/main.ts`,
      `apps/${project}/src/app/app.module.ts`
    );

    // check the right VSCode extensions are recommended
    expect(readJson('.vscode/extensions.json').recommendations).toEqual([
      'angular.ng-template',
      'nrwl.angular-console',
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
    ]);

    // check package.json
    const updatedPackageJson = readJson('package.json');
    expect(updatedPackageJson.description).toEqual('some description');
    expect(updatedPackageJson.scripts).toEqual({
      ng: 'nx',
      start: 'ng serve',
      build: 'ng build',
      watch: 'ng build --watch --configuration development',
      test: 'ng test',
      nx: 'nx',
      'affected:apps': 'nx affected:apps',
      'affected:libs': 'nx affected:libs',
      'affected:build': 'nx affected:build',
      'affected:e2e': 'nx affected:e2e',
      'affected:test': 'nx affected:test',
      'affected:lint': 'nx affected:lint',
      'affected:graph': 'nx affected:graph',
      affected: 'nx affected',
      format: 'nx format:write',
      'format:write': 'nx format:write',
      'format:check': 'nx format:check',
      update: 'ng update @nrwl/workspace',
      'update:check': 'ng update',
      lint: 'nx workspace-lint && ng lint',
      graph: 'nx graph',
      'workspace-schematic': 'nx workspace-schematic',
      help: 'nx help',
      postinstall: 'node ./decorate-angular-cli.js',
    });
    expect(updatedPackageJson.devDependencies['@nrwl/workspace']).toBeDefined();
    expect(updatedPackageJson.devDependencies['@angular/cli']).toBeDefined();

    // check nx.json
    const nxJson = readJson('nx.json');
    expect(nxJson).toEqual({
      npmScope: 'projscope',
      affected: { defaultBase: 'main' },
      implicitDependencies: {
        'angular.json': '*',
        'package.json': '*',
        'tslint.json': '*',
        '.eslintrc.json': '*',
        'tsconfig.base.json': '*',
        'nx.json': '*',
      },
      cli: { defaultCollection: '@nrwl/angular', packageManager },
      defaultProject: project,
    });

    // check angular.json
    const updatedAngularCLIJson = readJson('angular.json');
    expect(updatedAngularCLIJson.projects[project].root).toEqual(
      `apps/${project}`
    );
    expect(updatedAngularCLIJson.projects[project].sourceRoot).toEqual(
      `apps/${project}/src`
    );
    expect(updatedAngularCLIJson.projects[project].architect.build).toEqual({
      builder: '@angular-devkit/build-angular:browser',
      options: {
        outputPath: `dist/apps/${project}`,
        index: `apps/${project}/src/index.html`,
        main: `apps/${project}/src/main.ts`,
        polyfills: `apps/${project}/src/polyfills.ts`,
        tsConfig: `apps/${project}/tsconfig.app.json`,
        assets: [
          `apps/${project}/src/favicon.ico`,
          `apps/${project}/src/assets`,
        ],
        styles: [`apps/${project}/src/styles.css`],
        scripts: [`apps/${project}/src/scripts.ts`],
      },
      configurations: {
        production: {
          fileReplacements: [
            {
              replace: `apps/${project}/src/environments/environment.ts`,
              with: `apps/${project}/src/environments/environment.prod.ts`,
            },
          ],
          budgets: [
            {
              type: 'initial',
              maximumWarning: '500kb',
              maximumError: '1mb',
            },
            {
              type: 'anyComponentStyle',
              maximumWarning: '2kb',
              maximumError: '4kb',
            },
          ],
          outputHashing: 'all',
        },
        development: {
          buildOptimizer: false,
          optimization: false,
          vendorChunk: true,
          extractLicenses: false,
          sourceMap: true,
          namedChunks: true,
        },
      },
      defaultConfiguration: 'production',
    });
    expect(updatedAngularCLIJson.projects[project].architect.serve).toEqual({
      builder: '@angular-devkit/build-angular:dev-server',
      configurations: {
        production: { browserTarget: `${project}:build:production` },
        development: { browserTarget: `${project}:build:development` },
      },
      defaultConfiguration: 'development',
    });
    expect(updatedAngularCLIJson.projects[project].architect.test).toEqual({
      builder: '@angular-devkit/build-angular:karma',
      options: {
        main: `apps/${project}/src/test.ts`,
        polyfills: `apps/${project}/src/polyfills.ts`,
        tsConfig: `apps/${project}/tsconfig.spec.json`,
        karmaConfig: `apps/${project}/karma.conf.js`,
        assets: [
          `apps/${project}/src/favicon.ico`,
          `apps/${project}/src/assets`,
        ],
        styles: [`apps/${project}/src/styles.css`],
        scripts: [`apps/${project}/src/scripts.ts`],
      },
    });

    // check e2e project config
    expect(
      updatedAngularCLIJson.projects[project].architect.e2e
    ).toBeUndefined();
    expect(updatedAngularCLIJson.projects[`${project}-e2e`].root).toEqual(
      `apps/${project}-e2e`
    );
    expect(
      updatedAngularCLIJson.projects[`${project}-e2e`].architect.e2e
    ).toEqual({
      builder: '@angular-devkit/build-angular:protractor',
      options: {
        protractorConfig: `apps/${project}-e2e/protractor.conf.js`,
        devServerTarget: `${project}:serve`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });

    runCLI('build --configuration production --outputHashing none');
    checkFilesExist(`dist/apps/${project}/main.js`);
  });

  it('should handle different types of errors', () => {
    addProtractor();

    // Remove e2e directory
    runCommand('mv e2e e2e-bak');
    expect(() => runNgAdd('--npm-scope projscope --skip-install')).toThrow(
      'An e2e project was specified but e2e/protractor.conf.js could not be found.'
    );
    // Restore e2e directory
    runCommand('mv e2e-bak e2e');

    // TODO: this functionality is currently broken, this validation doesn't exist
    // // Remove src
    // runCommand('mv src src-bak');
    // expect(() => runNgAdd('--npm-scope projscope --skip-install')).toThrow(
    //   'Path: src does not exist'
    // );

    // // Put src back
    // runCommand('mv src-bak src');
  });

  it('should support preserveAngularCliLayout', () => {
    runNgAdd('--preserve-angular-cli-layout');

    const updatedAngularCLIJson = readJson('angular.json');
    expect(updatedAngularCLIJson.projects[project].root).toEqual('');
    expect(updatedAngularCLIJson.projects[project].sourceRoot).toEqual('src');

    const output = runCLI('build');
    expect(output).toContain(`> nx run ${project}:build:production`);
  });
});
