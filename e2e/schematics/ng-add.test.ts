import {
  checkFilesExist,
  cleanup,
  copyMissingPackages,
  runCLI,
  runNgNew,
  updateFile,
  readJson
} from '../utils';

describe('Nrwl Convert to Nx Workspace', () => {
  beforeEach(cleanup);

  it('should generate a workspace', () => {
    runNgNew();
    copyMissingPackages();

    // update package.json
    const packageJson = readJson('package.json');
    packageJson.description = 'some description';
    updateFile('package.json', JSON.stringify(packageJson, null, 2));
    // confirm that @nrwl and @ngrx dependencies do not exist yet
    expect(packageJson.devDependencies['@nrwl/schematics']).not.toBeDefined();
    expect(packageJson.dependencies['@nrwl/nx']).not.toBeDefined();
    expect(packageJson.dependencies['@ngrx/store']).not.toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).not.toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).not.toBeDefined();
    expect(packageJson.dependencies['@ngrx/store-devtools']).not.toBeDefined();

    // update tsconfig.json
    const tsconfigJson = readJson('tsconfig.json');
    tsconfigJson.compilerOptions.paths = { a: ['b'] };
    updateFile('tsconfig.json', JSON.stringify(tsconfigJson, null, 2));

    // update angular-cli.json
    const angularCLIJson = readJson('angular.json');
    angularCLIJson.projects.proj.architect.build.options.scripts = [
      'node_modules/x.js'
    ];
    angularCLIJson.projects.proj.architect.test.options.styles = [
      'src/styles.css'
    ];
    updateFile('angular.json', JSON.stringify(angularCLIJson, null, 2));

    // run the command
    runCLI('add @nrwl/schematics --npmScope projscope --skip-install');

    // check that prettier config exits and that files have been moved!
    checkFilesExist(
      '.prettierrc',
      'apps/proj/src/main.ts',
      'apps/proj/src/app/app.module.ts'
    );

    // check that package.json got merged
    const updatedPackageJson = readJson('package.json');
    expect(updatedPackageJson.description).toEqual('some description');
    expect(
      updatedPackageJson.devDependencies['@nrwl/schematics']
    ).toBeDefined();
    expect(updatedPackageJson.dependencies['@nrwl/nx']).toBeDefined();
    expect(updatedPackageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(updatedPackageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(updatedPackageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(
      updatedPackageJson.dependencies['@ngrx/store-devtools']
    ).toBeDefined();

    const nxJson = readJson('nx.json');
    expect(nxJson).toEqual({
      npmScope: 'projscope',
      projects: {
        proj: {
          tags: []
        },
        'proj-e2e': {
          tags: []
        }
      }
    });

    // check if angular-cli.json get merged
    const updatedAngularCLIJson = readJson('angular.json');
    expect(updatedAngularCLIJson.projects.proj.root).toEqual('apps/proj');
    expect(updatedAngularCLIJson.projects.proj.sourceRoot).toEqual(
      'apps/proj/src'
    );

    expect(updatedAngularCLIJson.projects.proj.architect.build).toEqual({
      builder: '@angular-devkit/build-angular:browser',
      options: {
        outputPath: 'dist/apps/proj',
        index: 'apps/proj/src/index.html',
        main: 'apps/proj/src/main.ts',
        polyfills: 'apps/proj/src/polyfills.ts',
        tsConfig: 'apps/proj/tsconfig.app.json',
        assets: ['apps/proj/src/favicon.ico', 'apps/proj/src/assets'],
        styles: ['apps/proj/src/styles.css'],
        scripts: ['node_modules/x.js']
      },
      configurations: {
        production: {
          fileReplacements: [
            {
              replace: 'apps/proj/src/environments/environment.ts',
              with: 'apps/proj/src/environments/environment.prod.ts'
            }
          ],
          optimization: true,
          outputHashing: 'all',
          sourceMap: false,
          extractCss: true,
          namedChunks: false,
          aot: true,
          extractLicenses: true,
          vendorChunk: false,
          buildOptimizer: true
        }
      }
    });
    expect(updatedAngularCLIJson.projects.proj.architect.serve).toEqual({
      builder: '@angular-devkit/build-angular:dev-server',
      options: {
        browserTarget: 'proj:build'
      },
      configurations: {
        production: {
          browserTarget: 'proj:build:production'
        }
      }
    });

    expect(updatedAngularCLIJson.projects.proj.architect.test).toEqual({
      builder: '@angular-devkit/build-angular:karma',
      options: {
        main: 'apps/proj/src/test.ts',
        polyfills: 'apps/proj/src/polyfills.ts',
        tsConfig: 'apps/proj/tsconfig.spec.json',
        karmaConfig: 'apps/proj/karma.conf.js',
        styles: ['apps/proj/src/styles.css'],
        scripts: [],
        assets: ['apps/proj/src/favicon.ico', 'apps/proj/src/assets']
      }
    });

    expect(updatedAngularCLIJson.projects.proj.architect.lint).toEqual({
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: [
          'apps/proj/tsconfig.app.json',
          'apps/proj/tsconfig.spec.json'
        ],
        exclude: ['**/node_modules/**']
      }
    });

    expect(updatedAngularCLIJson.projects['proj-e2e'].root).toEqual(
      'apps/proj-e2e'
    );
    expect(updatedAngularCLIJson.projects['proj-e2e'].architect.e2e).toEqual({
      builder: '@angular-devkit/build-angular:protractor',
      options: {
        protractorConfig: 'apps/proj-e2e/protractor.conf.js',
        devServerTarget: 'proj:serve'
      }
    });
    expect(updatedAngularCLIJson.projects['proj-e2e'].architect.lint).toEqual({
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: 'apps/proj-e2e/tsconfig.e2e.json',
        exclude: ['**/node_modules/**']
      }
    });

    // check if tsconfig.json get merged
    const updatedTsConfig = readJson('tsconfig.json');
    expect(updatedTsConfig.compilerOptions.paths).toEqual({
      a: ['b'],
      '@projscope/*': ['libs/*']
    });
  });

  it('should generate a workspace and not change dependencies or devDependencies if they already exist', () => {
    // create a new AngularCLI app
    runNgNew();
    const nxVersion = '0.0.0';
    const schematicsVersion = '0.0.0';
    const ngrxVersion = '0.0.0';
    // update package.json
    const existingPackageJson = readJson('package.json');
    existingPackageJson.devDependencies['@nrwl/schematics'] = schematicsVersion;
    existingPackageJson.dependencies['@nrwl/nx'] = nxVersion;
    existingPackageJson.dependencies['@ngrx/store'] = ngrxVersion;
    existingPackageJson.dependencies['@ngrx/effects'] = ngrxVersion;
    existingPackageJson.dependencies['@ngrx/router-store'] = ngrxVersion;
    existingPackageJson.dependencies['@ngrx/store-devtools'] = ngrxVersion;
    updateFile('package.json', JSON.stringify(existingPackageJson, null, 2));
    // run the command
    runCLI('add @nrwl/schematics --npmScope projscope --skip-install');
    // check that dependencies and devDependencies remained the same
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['@nrwl/schematics']).toEqual(
      schematicsVersion
    );
    expect(packageJson.dependencies['@nrwl/nx']).toEqual(nxVersion);
    expect(packageJson.dependencies['@ngrx/store']).toEqual(ngrxVersion);
    expect(packageJson.dependencies['@ngrx/effects']).toEqual(ngrxVersion);
    expect(packageJson.dependencies['@ngrx/router-store']).toEqual(ngrxVersion);
    expect(packageJson.dependencies['@ngrx/store-devtools']).toEqual(
      ngrxVersion
    );
  });
});
