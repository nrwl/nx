import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  packageInstall,
  readJson,
  runCLI,
  runCommand,
  runNgAdd,
  runNgNew,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
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
        it('should pass', () => {
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

  function addCypress9() {
    runNgAdd('@cypress/schematic', '--e2e-update', '1.7.0');
    packageInstall('cypress', null, '^9.0.0');
  }

  function addCypress10() {
    runNgAdd('@cypress/schematic', '--e2e', 'latest');
  }

  function addEsLint() {
    runNgAdd('@angular-eslint/schematics', undefined, 'latest');
  }

  beforeEach(() => {
    packageManager = getSelectedPackageManager();
    // TODO: solve issues with pnpm and remove this fallback
    packageManager = packageManager === 'pnpm' ? 'yarn' : packageManager;
    project = runNgNew(packageManager);
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
    updateFile('src/scripts.js', 'const x = 1;');

    // update angular.json
    const angularJson = readJson('angular.json');
    angularJson.projects[project].architect.build.options.scripts =
      angularJson.projects[project].architect.test.options.scripts = [
        'src/scripts.js',
      ];
    angularJson.projects[project].architect.test.options.styles = [
      'src/styles.css',
    ];
    updateFile('angular.json', JSON.stringify(angularJson, null, 2));

    // confirm that @nx dependencies do not exist yet
    expect(packageJson.devDependencies['@nx/workspace']).not.toBeDefined();

    // run ng add
    runNgAdd('@nx/angular', '--npm-scope projscope --default-base main');

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
      ng: 'ng',
      start: 'nx serve',
      build: 'nx build',
      watch: 'nx build --watch --configuration development',
      test: 'nx test',
    });
    expect(updatedPackageJson.devDependencies['@nx/workspace']).toBeDefined();
    expect(updatedPackageJson.devDependencies['@angular/cli']).toBeDefined();

    // check nx.json
    const nxJson = readJson('nx.json');
    expect(nxJson).toEqual({
      affected: {
        defaultBase: 'main',
      },
      tasksRunnerOptions: {
        default: {
          options: {
            cacheableOperations: ['build', 'test', 'e2e'],
          },
          runner: 'nx/tasks-runners/default',
        },
      },
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: [
          'default',
          '!{projectRoot}/tsconfig.spec.json',
          '!{projectRoot}/**/*.spec.[jt]s',
          '!{projectRoot}/karma.conf.js',
        ],
        sharedGlobals: [],
      },
      targetDefaults: {
        build: {
          dependsOn: ['^build'],
          inputs: ['production', '^production'],
        },
        e2e: {
          inputs: ['default', '^production'],
        },
        test: {
          inputs: ['default', '^production', '{workspaceRoot}/karma.conf.js'],
        },
      },
    });

    // check angular.json does not exist
    checkFilesDoNotExist('angular.json');

    // check project configuration
    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.sourceRoot).toEqual(`apps/${project}/src`);
    expect(projectConfig.targets.build).toStrictEqual({
      executor: '@angular-devkit/build-angular:browser',
      options: {
        outputPath: `dist/apps/${project}`,
        index: `apps/${project}/src/index.html`,
        main: `apps/${project}/src/main.ts`,
        polyfills: [`zone.js`],
        tsConfig: `apps/${project}/tsconfig.app.json`,
        assets: [
          `apps/${project}/src/favicon.ico`,
          `apps/${project}/src/assets`,
        ],
        styles: [`apps/${project}/src/styles.css`],
        scripts: [`apps/${project}/src/scripts.js`],
      },
      configurations: {
        production: {
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
    expect(projectConfig.targets.test).toStrictEqual({
      executor: '@angular-devkit/build-angular:karma',
      options: {
        polyfills: [`zone.js`, `zone.js/testing`],
        tsConfig: `apps/${project}/tsconfig.spec.json`,
        assets: [
          `apps/${project}/src/favicon.ico`,
          `apps/${project}/src/assets`,
        ],
        styles: [`apps/${project}/src/styles.css`],
        scripts: [`apps/${project}/src/scripts.js`],
      },
    });
    expect(projectConfig.targets.e2e).toBeUndefined();

    // check e2e project config
    const e2eProjectConfig = readJson(`apps/${project}-e2e/project.json`);
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

    runCLI(`build ${project} --configuration production --outputHashing none`);
    checkFilesExist(`dist/apps/${project}/main.js`);
  });

  it('should handle a workspace with cypress v9', () => {
    addCypress9();

    runNgAdd('@nx/angular', '--npm-scope projscope --skip-install');

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
    expect(e2eProjectConfig.targets['cypress-run']).toEqual({
      executor: '@nx/cypress:cypress',
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
      executor: '@nx/cypress:cypress',
      options: {
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
    });
    expect(e2eProjectConfig.targets.e2e).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
  });

  it('should handle a workspace with cypress v10', () => {
    addCypress10();

    runNgAdd('@nx/angular', '--npm-scope projscope --skip-install');

    const e2eProject = `${project}-e2e`;
    //check e2e project files
    checkFilesDoNotExist(
      'cypress.config.ts',
      'cypress/tsconfig.json',
      'cypress/e2e/spec.cy.ts',
      'cypress/fixtures/example.json',
      'cypress/support/commands.ts',
      'cypress/support/e2e.ts'
    );
    checkFilesExist(
      `apps/${e2eProject}/cypress.config.ts`,
      `apps/${e2eProject}/tsconfig.json`,
      `apps/${e2eProject}/src/e2e/spec.cy.ts`,
      `apps/${e2eProject}/src/fixtures/example.json`,
      `apps/${e2eProject}/src/support/commands.ts`,
      `apps/${e2eProject}/src/support/e2e.ts`
    );

    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.targets['cypress-run']).toBeUndefined();
    expect(projectConfig.targets['cypress-open']).toBeUndefined();
    expect(projectConfig.targets.e2e).toBeUndefined();

    // check e2e project config
    const e2eProjectConfig = readJson(`apps/${project}-e2e/project.json`);
    expect(e2eProjectConfig.targets['cypress-run']).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        cypressConfig: `apps/${e2eProject}/cypress.config.ts`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
    expect(e2eProjectConfig.targets['cypress-open']).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.config.ts`,
      },
    });
    expect(e2eProjectConfig.targets.e2e).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.config.ts`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
  });

  // TODO(leo): The current Verdaccio setup fails to resolve older versions
  // of @nx/* packages, the @angular-eslint/builder package depends on an
  // older version of @nx/devkit so we skip this test for now.
  it.skip('should handle a workspace with ESLint', () => {
    addEsLint();

    runNgAdd('@nx/angular', '--npm-scope projscope');

    checkFilesExist(`apps/${project}/.eslintrc.json`, `.eslintrc.json`);

    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.targets.lint).toStrictEqual({
      executor: '@nx/linter:eslint',
      options: {
        lintFilePatterns: [
          `apps/${project}/src/**/*.ts`,
          `apps/${project}/src/**/*.html`,
        ],
      },
    });

    let output = runCLI(`lint ${project}`);
    expect(output).toContain(`> nx run ${project}:lint`);
    expect(output).toContain('All files pass linting.');
    expect(output).toContain(
      `Successfully ran target lint for project ${project}`
    );

    output = runCLI(`lint ${project}`);
    expect(output).toContain(`> nx run ${project}:lint  [local cache]`);
    expect(output).toContain('All files pass linting.');
    expect(output).toContain(
      `Successfully ran target lint for project ${project}`
    );
  });

  it('should support a workspace with multiple projects', () => {
    // add other projects
    const app1 = uniq('app1');
    const lib1 = uniq('lib1');
    runCommand(`ng g @schematics/angular:application ${app1}`);
    runCommand(`ng g @schematics/angular:library ${lib1}`);

    runNgAdd('@nx/angular', '--npm-scope projscope');

    // check angular.json does not exist
    checkFilesDoNotExist('angular.json');

    // check building project
    let output = runCLI(`build ${project} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${project}:build:production --outputHashing none`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${project}`
    );
    checkFilesExist(`dist/apps/${project}/main.js`);

    output = runCLI(`build ${project} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${project}:build:production --outputHashing none  [local cache]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${project}`
    );

    // check building app1
    output = runCLI(`build ${app1} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${app1}:build:production --outputHashing none`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${app1}`
    );
    checkFilesExist(`dist/apps/${app1}/main.js`);

    output = runCLI(`build ${app1} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${app1}:build:production --outputHashing none  [local cache]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${app1}`
    );

    // check building lib1
    output = runCLI(`build ${lib1}`);
    expect(output).toContain(`> nx run ${lib1}:build:production`);
    expect(output).toContain(
      `Successfully ran target build for project ${lib1}`
    );
    checkFilesExist(`dist/${lib1}/package.json`);

    output = runCLI(`build ${lib1}`);
    expect(output).toContain(
      `> nx run ${lib1}:build:production  [local cache]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${lib1}`
    );
  });
});
