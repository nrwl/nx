process.env.SELECTED_CLI = 'angular';

import {
  checkFilesDoNotExist,
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
import { PackageManager } from 'nx/src/utils/package-manager';

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

  function addCypress() {
    runNgAdd('@cypress/schematic', '--e2e-update', 'latest');
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
    runNgAdd('@nrwl/angular', '--npm-scope projscope --default-base main');

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
      start: 'nx serve',
      build: 'nx build',
      watch: 'nx build --watch --configuration development',
      test: 'nx test',
      postinstall: 'node ./decorate-angular-cli.js',
    });
    expect(updatedPackageJson.devDependencies['@nrwl/workspace']).toBeDefined();
    expect(updatedPackageJson.devDependencies['@angular/cli']).toBeDefined();

    // check nx.json
    const nxJson = readJson('nx.json');
    expect(nxJson).toEqual({
      affected: {
        defaultBase: 'main',
      },
      cli: {
        defaultCollection: '@nrwl/angular',
        packageManager: packageManager,
      },
      defaultProject: project,
      implicitDependencies: {
        '.eslintrc.json': '*',
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
      },
      npmScope: 'projscope',
      targetDependencies: {
        build: [
          {
            projects: 'dependencies',
            target: 'build',
          },
        ],
      },
      tasksRunnerOptions: {
        default: {
          options: {
            cacheableOperations: ['build', 'lint', 'test', 'e2e'],
          },
          runner: 'nx/tasks-runners/default',
        },
      },
    });

    // check angular.json
    expect(readJson('angular.json')).toStrictEqual({
      version: 2,
      projects: {
        [project]: `apps/${project}`,
        [`${project}-e2e`]: `apps/${project}-e2e`,
      },
    });

    // check project configuration
    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.root).toEqual(`apps/${project}`);
    expect(projectConfig.sourceRoot).toEqual(`apps/${project}/src`);
    expect(projectConfig.targets.build).toEqual({
      executor: '@angular-devkit/build-angular:browser',
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
    expect(projectConfig.targets.serve).toEqual({
      executor: '@angular-devkit/build-angular:dev-server',
      configurations: {
        production: { browserTarget: `${project}:build:production` },
        development: { browserTarget: `${project}:build:development` },
      },
      defaultConfiguration: 'development',
    });
    expect(projectConfig.targets.test).toEqual({
      executor: '@angular-devkit/build-angular:karma',
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
    expect(projectConfig.targets.e2e).toBeUndefined();

    // check e2e project config
    const e2eProjectConfig = readJson(`apps/${project}-e2e/project.json`);
    expect(e2eProjectConfig.root).toEqual(`apps/${project}-e2e`);
    expect(e2eProjectConfig.targets.e2e).toEqual({
      executor: '@angular-devkit/build-angular:protractor',
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
    expect(() =>
      runNgAdd('@nrwl/angular', '--npm-scope projscope --skip-install')
    ).toThrow(
      'An e2e project with Protractor was found but "e2e/protractor.conf.js" could not be found.'
    );
    // Restore e2e directory
    runCommand('mv e2e-bak e2e');

    // TODO: this functionality is currently broken, this validation doesn't exist
    // // Remove src
    // runCommand('mv src src-bak');
    // expect(() => runNgAdd('@nrwl/angular', '--npm-scope projscope --skip-install')).toThrow(
    //   'Path: src does not exist'
    // );

    // // Put src back
    // runCommand('mv src-bak src');
  });

  it('should handle wrong cypress setup', () => {
    addCypress();

    // Remove cypress.json
    runCommand('mv cypress.json cypress.json.bak');
    expect(() =>
      runNgAdd('@nrwl/angular', '--npm-scope projscope --skip-install')
    ).toThrow(
      'An e2e project with Cypress was found but "cypress.json" could not be found.'
    );
    // Restore cypress.json
    runCommand('mv cypress.json.bak cypress.json');

    // Remove cypress directory
    runCommand('mv cypress cypress-bak');
    expect(() =>
      runNgAdd('@nrwl/angular', '--npm-scope projscope --skip-install')
    ).toThrow(
      'An e2e project with Cypress was found but the "cypress" directory could not be found.'
    );
    // Restore cypress.json
    runCommand('mv cypress-bak cypress');
  });

  it('should handle a workspace with cypress', () => {
    addCypress();

    runNgAdd('@nrwl/angular', '--npm-scope projscope --skip-install');

    const e2eProject = `${project}-e2e`;
    //check e2e project files
    checkFilesDoNotExist(
      'cypress.json',
      'cypress/tsconfig.json',
      'cypress/integration/spec.ts',
      'cypress/plugins/index.ts',
      'cypress/support/commands.ts',
      'cypress/support/index.ts'
    );
    checkFilesExist(
      `apps/${e2eProject}/cypress.json`,
      `apps/${e2eProject}/tsconfig.json`,
      `apps/${e2eProject}/src/integration/spec.ts`,
      `apps/${e2eProject}/src/plugins/index.ts`,
      `apps/${e2eProject}/src/support/commands.ts`,
      `apps/${e2eProject}/src/support/index.ts`
    );

    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.targets['cypress-run']).toBeUndefined();
    expect(projectConfig.targets['cypress-open']).toBeUndefined();
    expect(projectConfig.targets.e2e).toBeUndefined();

    // check e2e project config
    const e2eProjectConfig = readJson(`apps/${project}-e2e/project.json`);
    expect(e2eProjectConfig.root).toEqual(`apps/${e2eProject}`);
    expect(e2eProjectConfig.targets['cypress-run']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
    expect(e2eProjectConfig.targets['cypress-open']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        watch: true,
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
    });
    expect(e2eProjectConfig.targets.e2e).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        watch: true,
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
  });

  it('should support --preserve-angular-cli-layout', () => {
    // add another app and a library
    runCommand(`ng g @schematics/angular:application app2`);
    runCommand(`ng g @schematics/angular:library lib1`);

    runNgAdd('@nrwl/angular', '--preserve-angular-cli-layout');

    // check config still uses Angular CLI layout
    const updatedAngularJson = readJson('angular.json');
    expect(updatedAngularJson.projects[project].root).toEqual('');
    expect(updatedAngularJson.projects[project].sourceRoot).toEqual('src');
    expect(updatedAngularJson.projects.app2.root).toEqual('projects/app2');
    expect(updatedAngularJson.projects.app2.sourceRoot).toEqual(
      'projects/app2/src'
    );
    expect(updatedAngularJson.projects.lib1.root).toEqual('projects/lib1');
    expect(updatedAngularJson.projects.lib1.sourceRoot).toEqual(
      'projects/lib1/src'
    );

    // check building an app
    let output = runCLI(`build ${project} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${project}:build:production --outputHashing=none`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${project}`
    );
    checkFilesExist(`dist/${project}/main.js`);

    output = runCLI(`build ${project} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${project}:build:production --outputHashing=none  [existing outputs match the cache, left as is]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${project}`
    );

    // check building lib1
    output = runCLI('build lib1');
    expect(output).toContain('> nx run lib1:build:production');
    expect(output).toContain('Successfully ran target build for project lib1');
    checkFilesExist('dist/lib1/package.json');

    output = runCLI('build lib1');
    expect(output).toContain(
      '> nx run lib1:build:production  [existing outputs match the cache, left as is]'
    );
    expect(output).toContain('Successfully ran target build for project lib1');
  });
});
