import {
  checkFilesDoNotExist,
  checkFilesExist,
  packageInstall,
  readJson,
  runCLI,
  runNgAdd,
  updateFile,
} from '@nx/e2e-utils';
import {
  setupNgAddTest,
  cleanupNgAddTest,
  addProtractor,
  NgAddTestContext,
} from './ng-add-setup';

describe('convert Angular CLI workspace to an Nx workspace', () => {
  let context: NgAddTestContext;

  beforeEach(() => {
    context = setupNgAddTest();
  });

  afterEach(() => {
    cleanupNgAddTest();
  });

  it('should generate a workspace', () => {
    const { project } = context;
    addProtractor(project);

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
    runCLI('g @nx/angular:ng-add --default-base main');

    // check that prettier config exits and that files have been moved
    checkFilesExist(
      '.vscode/extensions.json',
      '.prettierrc',
      `apps/${project}/src/main.ts`,
      `apps/${project}/src/app/app.config.ts`,
      `apps/${project}/src/app/app.ts`,
      `apps/${project}/src/app/app.routes.ts`
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
      defaultBase: 'main',
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
          cache: true,
        },
        e2e: {
          inputs: ['default', '^production'],
          cache: true,
        },
        test: {
          inputs: ['default', '^production', '{workspaceRoot}/karma.conf.js'],
          cache: true,
        },
      },
    });

    // check angular.json does not exist
    checkFilesDoNotExist('angular.json');

    // check project configuration
    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.sourceRoot).toEqual(`apps/${project}/src`);
    expect(projectConfig.targets.build).toStrictEqual({
      executor: '@angular/build:application',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: `dist/${project}`,
        browser: `apps/${project}/src/main.ts`,
        polyfills: [`zone.js`],
        tsConfig: `apps/${project}/tsconfig.app.json`,
        assets: [{ glob: '**/*', input: `apps/${project}/public` }],
        styles: [`apps/${project}/src/styles.css`],
        scripts: [`apps/${project}/src/scripts.js`],
      },
      configurations: {
        production: {
          budgets: [
            {
              type: 'initial',
              maximumWarning: '500kB',
              maximumError: '1MB',
            },
            {
              type: 'anyComponentStyle',
              maximumWarning: '4kB',
              maximumError: '8kB',
            },
          ],
          outputHashing: 'all',
        },
        development: {
          optimization: false,
          extractLicenses: false,
          sourceMap: true,
        },
      },
      defaultConfiguration: 'production',
    });
    expect(projectConfig.targets.serve).toEqual({
      executor: '@angular/build:dev-server',
      configurations: {
        production: { buildTarget: `${project}:build:production` },
        development: { buildTarget: `${project}:build:development` },
      },
      defaultConfiguration: 'development',
    });
    expect(projectConfig.targets.test).toStrictEqual({
      executor: '@angular/build:karma',
      options: {
        polyfills: [`zone.js`, `zone.js/testing`],
        tsConfig: `apps/${project}/tsconfig.spec.json`,
        assets: [{ glob: '**/*', input: `apps/${project}/public` }],
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
    checkFilesExist(`dist/${project}/browser/main.js`);
  });
});
