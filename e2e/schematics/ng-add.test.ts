import {
  checkFilesExist,
  cleanup,
  copyMissingPackages,
  runCLI,
  runNgNew,
  updateFile,
  readJson,
  readFile,
  runCommand,
  runCLIAsync,
  runsInWSL
} from '../utils';

if (!runsInWSL()) {
  describe('Nrwl Convert to Nx Workspace', () => {
    beforeEach(cleanup);
    afterAll(cleanup);

    it('should generate a workspace', () => {
      runNgNew();

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
      expect(
        packageJson.devDependencies['@ngrx/store-devtools']
      ).not.toBeDefined();

      // update tsconfig.json
      const tsconfigJson = readJson('tsconfig.json');
      tsconfigJson.compilerOptions.paths = { a: ['b'] };
      updateFile('tsconfig.json', JSON.stringify(tsconfigJson, null, 2));

      updateFile('src/scripts.ts', '');

      // update angular-cli.json
      const angularCLIJson = readJson('angular.json');
      angularCLIJson.projects.proj.architect.build.options.scripts = angularCLIJson.projects.proj.architect.test.options.scripts = [
        'src/scripts.ts'
      ];
      angularCLIJson.projects.proj.architect.test.options.styles = [
        'src/styles.css'
      ];
      updateFile('angular.json', JSON.stringify(angularCLIJson, null, 2));

      // run the command
      runCLI('add @nrwl/schematics --npmScope projscope');

      // check that prettier config exits and that files have been moved!
      checkFilesExist(
        '.vscode/extensions.json',
        '.prettierrc',
        'apps/proj/src/main.ts',
        'apps/proj/src/app/app.module.ts'
      );

      expect(readJson('.vscode/extensions.json').recommendations).toEqual([
        'nrwl.angular-console',
        'angular.ng-template',
        'ms-vscode.vscode-typescript-tslint-plugin',
        'esbenp.prettier-vscode'
      ]);

      const appModuleContents = readFile('apps/proj/src/app/app.module.ts');
      expect(appModuleContents).toContain(
        `import { NxModule } from '@nrwl/nx';`
      );
      expect(appModuleContents).toContain(`NxModule.forRoot()`);

      // check that package.json got merged
      const updatedPackageJson = readJson('package.json');
      expect(updatedPackageJson.description).toEqual('some description');
      expect(updatedPackageJson.scripts).toEqual({
        ng: 'ng',
        start: 'ng serve',
        build: 'ng build',
        test: 'ng test',
        lint: './node_modules/.bin/nx lint && ng lint',
        e2e: 'ng e2e',
        'affected:apps': './node_modules/.bin/nx affected:apps',
        'affected:libs': './node_modules/.bin/nx affected:libs',
        'affected:build': './node_modules/.bin/nx affected:build',
        'affected:e2e': './node_modules/.bin/nx affected:e2e',
        'affected:test': './node_modules/.bin/nx affected:test',
        'affected:lint': './node_modules/.bin/nx affected:lint',
        'affected:dep-graph': './node_modules/.bin/nx affected:dep-graph',
        affected: './node_modules/.bin/nx affected',
        format: './node_modules/.bin/nx format:write',
        'format:write': './node_modules/.bin/nx format:write',
        'format:check': './node_modules/.bin/nx format:check',
        update: 'ng update @nrwl/schematics',
        'update:check': 'ng update',
        'dep-graph': './node_modules/.bin/nx dep-graph',
        'workspace-schematic': './node_modules/.bin/nx workspace-schematic',
        help: './node_modules/.bin/nx help'
      });
      expect(
        updatedPackageJson.devDependencies['@nrwl/schematics']
      ).toBeDefined();
      expect(updatedPackageJson.dependencies['@nrwl/nx']).toBeDefined();
      expect(updatedPackageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(updatedPackageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(
        updatedPackageJson.dependencies['@ngrx/router-store']
      ).toBeDefined();
      expect(
        updatedPackageJson.devDependencies['@ngrx/store-devtools']
      ).toBeDefined();
      expect(updatedPackageJson.devDependencies['@angular/cli']).toBeDefined();

      const nxJson = readJson('nx.json');
      expect(nxJson).toEqual({
        npmScope: 'projscope',
        implicitDependencies: {
          'angular.json': '*',
          'package.json': '*',
          'tslint.json': '*',
          'tsconfig.json': '*',
          'nx.json': '*'
        },
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
          scripts: ['apps/proj/src/scripts.ts'],
          es5BrowserSupport: true
        },
        configurations: {
          production: {
            fileReplacements: [
              {
                replace: 'apps/proj/src/environments/environment.ts',
                with: 'apps/proj/src/environments/environment.prod.ts'
              }
            ],
            budgets: [
              {
                maximumError: '5mb',
                maximumWarning: '2mb',
                type: 'initial'
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
          scripts: ['apps/proj/src/scripts.ts'],
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
        configurations: {
          production: {
            devServerTarget: 'proj:serve:production'
          }
        },
        options: {
          protractorConfig: 'apps/proj-e2e/protractor.conf.js',
          devServerTarget: 'proj:serve'
        }
      });
      expect(updatedAngularCLIJson.projects['proj-e2e'].architect.lint).toEqual(
        {
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: 'apps/proj-e2e/tsconfig.e2e.json',
            exclude: ['**/node_modules/**']
          }
        }
      );

      // check if tsconfig.json get merged
      const updatedTsConfig = readJson('tsconfig.json');
      expect(updatedTsConfig.compilerOptions.paths).toEqual({
        a: ['b'],
        '@projscope/*': ['libs/*']
      });

      const updatedTslint = readJson('tslint.json');
      expect(updatedTslint.rules['nx-enforce-module-boundaries']).toEqual([
        true,
        {
          allow: [],
          depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]
        }
      ]);

      runCLI('build --prod --outputHashing none');
      checkFilesExist('dist/apps/proj/main.js');
    });

    it('should generate a workspace and not change dependencies, devDependencies, or vscode extensions if they already exist', () => {
      // create a new AngularCLI app
      runNgNew();
      const nxVersion = '0.0.0';
      const schematicsVersion = '0.0.0';
      const ngrxVersion = '0.0.0';
      // update package.json
      const existingPackageJson = readJson('package.json');
      existingPackageJson.devDependencies[
        '@nrwl/schematics'
      ] = schematicsVersion;
      existingPackageJson.dependencies['@nrwl/nx'] = nxVersion;
      existingPackageJson.dependencies['@ngrx/store'] = ngrxVersion;
      existingPackageJson.dependencies['@ngrx/effects'] = ngrxVersion;
      existingPackageJson.dependencies['@ngrx/router-store'] = ngrxVersion;
      existingPackageJson.devDependencies['@ngrx/store-devtools'] = ngrxVersion;
      updateFile('package.json', JSON.stringify(existingPackageJson, null, 2));

      updateFile(
        '.vscode/extensions.json',
        JSON.stringify({
          recommendations: ['eamodio.gitlens', 'angular.ng-template']
        })
      );
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
      expect(packageJson.dependencies['@ngrx/router-store']).toEqual(
        ngrxVersion
      );
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toEqual(
        ngrxVersion
      );

      expect(readJson('.vscode/extensions.json').recommendations).toEqual([
        'eamodio.gitlens',
        'angular.ng-template',
        'nrwl.angular-console',
        'ms-vscode.vscode-typescript-tslint-plugin',
        'esbenp.prettier-vscode'
      ]);
    });

    it('should generate a workspace from a universal cli project', () => {
      // create a new AngularCLI app
      runNgNew();

      // Add Universal
      runCLI('generate universal --client-project proj');

      // Add @nrwl/schematics
      runCLI('add @nrwl/schematics --npmScope projscope');

      checkFilesExist('apps/proj/tsconfig.server.json');

      const serverTsConfig = readJson('apps/proj/tsconfig.server.json');

      expect(serverTsConfig).toEqual({
        extends: './tsconfig.app.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc/apps/proj-server',
          baseUrl: '.'
        },
        angularCompilerOptions: {
          entryModule: 'src/app/app.server.module#AppServerModule'
        }
      });

      const updatedAngularCLIJson = readJson('angular.json');

      expect(updatedAngularCLIJson.projects.proj.architect.server).toEqual({
        builder: '@angular-devkit/build-angular:server',
        options: {
          outputPath: 'dist/apps/proj-server',
          main: 'apps/proj/src/main.server.ts',
          tsConfig: 'apps/proj/tsconfig.server.json'
        },
        configurations: {
          production: {
            optimization: {
              scripts: false,
              styles: true
            },
            sourceMap: false,
            fileReplacements: [
              {
                replace: 'src/environments/environment.ts',
                with: 'src/environments/environment.prod.ts'
              }
            ]
          }
        }
      });

      runCLI('run proj:server');
      checkFilesExist('dist/apps/proj-server/main.js');
    });

    it('should convert a project with common libraries in the ecosystem', () => {
      // create a new AngularCLI app
      runNgNew();

      // Add some Angular libraries
      runCLI('add @angular/elements');
      runCLI('add @angular/material');
      runCLI('add @angular/pwa');
      runCLI('add @ngrx/store');
      runCLI('add @ngrx/effects');

      // Add Nx
      runCLI('add @nrwl/schematics');
    });

    it('should handle workspaces with no e2e project', async () => {
      // create a new AngularCLI app
      runNgNew();

      // Remove e2e
      runCommand('rm -rf e2e');
      const existingAngularJson = readJson('angular.json');
      delete existingAngularJson.projects['proj-e2e'];
      updateFile('angular.json', JSON.stringify(existingAngularJson, null, 2));

      // Add @nrwl/schematics
      const result = await runCLIAsync(
        'add @nrwl/schematics --npmScope projscope --skip-install'
      );

      checkFilesExist(
        '.prettierrc',
        'apps/proj/src/main.ts',
        'apps/proj/src/app/app.module.ts'
      );

      expect(result.stderr).toContain(
        'No e2e project was migrated because there was none declared in angular.json'
      );
    });

    it('should handle type array at tslint builder options.tsConfig (e2e project)', () => {
      // create a new AngularCLI app
      runNgNew();

      // set array at tslint builder options.tsConfig
      const existingAngularJson = readJson('angular.json');
      existingAngularJson.projects[
        'proj-e2e'
      ].architect.lint.options.tsConfig = ['e2e/tsconfig.e2e.json'];
      updateFile('angular.json', JSON.stringify(existingAngularJson, null, 2));

      // Add @nrwl/schematics
      runCLI('add @nrwl/schematics --npmScope projscope --skip-install');

      const updatedAngularCLIJson = readJson('angular.json');

      expect(updatedAngularCLIJson.projects['proj-e2e'].architect.lint).toEqual(
        {
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: ['apps/proj-e2e/tsconfig.e2e.json'],
            exclude: ['**/node_modules/**']
          }
        }
      );
    });

    it('should handle different types of errors', () => {
      // create a new AngularCLI app
      runNgNew();

      // Only remove e2e directory
      runCommand('mv e2e e2e-bak');
      try {
        runCLI('add @nrwl/schematics --npmScope projscope --skip-install');
        fail('Did not handle not having a e2e directory');
      } catch (e) {
        expect(e.stderr.toString()).toContain(
          'Your workspace could not be converted into an Nx Workspace because of the above error.'
        );
      }

      // Put e2e back
      runCommand('mv e2e-bak e2e');

      // Remove package.json
      runCommand('mv package.json package.json.bak');
      try {
        runCLI('add @nrwl/schematics --npmScope projscope --skip-install');
        fail('Did not handle not having a package.json');
      } catch (e) {
        expect(e.stderr.toString()).toContain(
          'Your workspace could not be converted into an Nx Workspace because of the above error.'
        );
      }

      // Put package.json back
      runCommand('mv package.json.bak package.json');

      // Remove src
      runCommand('mv src src-bak');
      try {
        runCLI('add @nrwl/schematics --npmScope projscope --skip-install');
        fail('Did not handle not having a src directory');
      } catch (e) {
        expect(e.stderr.toString()).toContain('Path: src does not exist');
      }

      // Put src back
      runCommand('mv src-bak src');
    });
  });
}
