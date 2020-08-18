import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { execSync, fork, spawn } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as treeKill from 'tree-kill';
import * as ts from 'typescript';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  ensureProject,
  forEachCli,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runNgNew,
  runNgAdd,
  tmpProjPath,
  uniq,
  updateFile,
  workspaceConfigName,
  yarnAdd,
} from '@nrwl/e2e/utils';

function getData(): Promise<any> {
  return new Promise((resolve) => {
    http.get('http://localhost:3333/api', (res) => {
      expect(res.statusCode).toEqual(200);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.once('end', () => {
        resolve(JSON.parse(data));
      });
    });
  });
}

forEachCli((currentCLIName) => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Node Applications', () => {
    it('should be able to generate an empty application', async () => {
      ensureProject();
      const nodeapp = uniq('nodeapp');

      runCLI(`generate @nrwl/node:app ${nodeapp} --linter=${linter}`);

      const lintResults = runCLI(`lint ${nodeapp}`);
      expect(lintResults).toContain('All files pass linting.');

      updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
      await runCLIAsync(`build ${nodeapp}`);

      checkFilesExist(`dist/apps/${nodeapp}/main.js`);
      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath(),
      }).toString();
      expect(result).toContain('Hello World!');
    }, 60000);

    it('should be able to generate an express application', async (done) => {
      ensureProject();
      const nodeapp = uniq('nodeapp');

      runCLI(`generate @nrwl/express:app ${nodeapp} --linter=${linter}`);
      const lintResults = runCLI(`lint ${nodeapp}`);
      expect(lintResults).toContain('All files pass linting.');

      updateFile(
        `apps/${nodeapp}/src/app/test.spec.ts`,
        `
          describe('test', () => {
            it('should work', () => {
              expect(true).toEqual(true);
            })
          })
        `
      );

      updateFile(`apps/${nodeapp}/src/assets/file.txt`, ``);
      const jestResult = await runCLIAsync(`test ${nodeapp}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
      await runCLIAsync(`build ${nodeapp}`);

      checkFilesExist(
        `dist/apps/${nodeapp}/main.js`,
        `dist/apps/${nodeapp}/assets/file.txt`,
        `dist/apps/${nodeapp}/main.js.map`
      );

      const server = fork(`./dist/apps/${nodeapp}/main.js`, [], {
        cwd: tmpProjPath(),
        silent: true,
      });
      expect(server).toBeTruthy();
      await new Promise((resolve) => {
        server.stdout.once('data', async (data) => {
          expect(data.toString()).toContain(
            'Listening at http://localhost:3333'
          );
          const result = await getData();

          expect(result.message).toEqual(`Welcome to ${nodeapp}!`);
          treeKill(server.pid, 'SIGTERM', (err) => {
            expect(err).toBeFalsy();
            resolve();
          });
        });
      });
      const config = readJson(workspaceConfigName());
      config.projects[nodeapp].architect.waitAndPrint = {
        builder: '@nrwl/workspace:run-commands',
        options: {
          commands: [
            {
              command: 'sleep 1 && echo DONE',
            },
          ],
          readyWhen: 'DONE',
        },
      };

      config.projects[nodeapp].architect.serve.options.waitUntilTargets = [
        `${nodeapp}:waitAndPrint`,
      ];
      updateFile(workspaceConfigName(), JSON.stringify(config));
      const process = spawn(
        'node',
        ['./node_modules/.bin/nx', 'serve', nodeapp],
        {
          cwd: tmpProjPath(),
        }
      );
      let collectedOutput = '';
      process.stdout.on('data', async (data: Buffer) => {
        collectedOutput += data.toString();
        if (!data.toString().includes('Listening at http://localhost:3333')) {
          return;
        }

        const result = await getData();
        expect(result.message).toEqual(`Welcome to ${nodeapp}!`);
        treeKill(process.pid, 'SIGTERM', (err) => {
          expect(collectedOutput.indexOf('DONE') > -1).toBeTruthy();
          expect(err).toBeFalsy();
          done();
        });
      });
    }, 120000);

    xit('should have correct ts options for nest application', async () => {
      if (currentCLIName === 'angular') {
        // Usually the tests use ensureProject() to setup the test workspace. But it will trigger
        // the nx workspace schematic which creates a tsconfig file containing the parameters
        // required by nest.
        // However, when creating an Angular workspace and adding the workspace capability (as
        // described in the docs) the tsconfig file could miss required options if Angular removes
        // them from their config files as happened with emitDecoratorMetadata.
        runNgNew();
        runNgAdd('--npmScope projscope');
        yarnAdd('@nrwl/nest');
      } else {
        ensureProject();
      }

      const nestapp = uniq('nestapp');
      runCLI(`generate @nrwl/nest:app ${nestapp} --linter=${linter}`);
      const configPath = tmpProjPath(`apps/${nestapp}/tsconfig.app.json`);
      const json = ts.readConfigFile(configPath, ts.sys.readFile);
      const config = ts.parseJsonConfigFileContent(
        json.config,
        ts.sys,
        path.dirname(configPath)
      ); // respects "extends" inside tsconfigs

      expect(config.options.emitDecoratorMetadata).toEqual(true); // required by nest to function properly
      expect(config.options.target).toEqual(ts.ScriptTarget.ES2015); // required by nest swagger to function properly
    }, 120000);

    it('should be able to generate a nest application', async (done) => {
      ensureProject();
      const nestapp = uniq('nestapp');
      runCLI(`generate @nrwl/nest:app ${nestapp} --linter=${linter}`);

      const lintResults = runCLI(`lint ${nestapp}`);
      expect(lintResults).toContain('All files pass linting.');

      updateFile(`apps/${nestapp}/src/assets/file.txt`, ``);
      const jestResult = await runCLIAsync(`test ${nestapp}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );

      await runCLIAsync(`build ${nestapp}`);

      checkFilesExist(
        `dist/apps/${nestapp}/main.js`,
        `dist/apps/${nestapp}/assets/file.txt`,
        `dist/apps/${nestapp}/main.js.map`
      );

      const server = fork(`./dist/apps/${nestapp}/main.js`, [], {
        cwd: tmpProjPath(),
        silent: true,
      });
      expect(server).toBeTruthy();

      await new Promise((resolve) => {
        server.stdout.on('data', async (data) => {
          const message = data.toString();
          if (message.includes('Listening at http://localhost:3333')) {
            const result = await getData();

            expect(result.message).toEqual(`Welcome to ${nestapp}!`);
            treeKill(server.pid, 'SIGTERM', (err) => {
              expect(err).toBeFalsy();
              resolve();
            });
          }
        });
      });

      const process = spawn(
        'node',
        ['./node_modules/@nrwl/cli/bin/nx', 'serve', nestapp],
        {
          cwd: tmpProjPath(),
        }
      );

      process.stdout.on('data', async (data: Buffer) => {
        if (!data.toString().includes('Listening at http://localhost:3333')) {
          return;
        }
        const result = await getData();
        expect(result.message).toEqual(`Welcome to ${nestapp}!`);
        treeKill(process.pid, 'SIGTERM', (err) => {
          expect(err).toBeFalsy();
          done();
        });
      });
    }, 120000);
  });

  describe('Node Libraries', () => {
    it('should be able to generate a node library', async () => {
      ensureProject();
      const nodelib = uniq('nodelib');

      runCLI(`generate @nrwl/node:lib ${nodelib}`);

      const lintResults = runCLI(`lint ${nodelib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nodelib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 60000);

    it('should be able to generate a publishable node library', async () => {
      ensureProject();

      const nodeLib = uniq('nodelib');
      runCLI(
        `generate @nrwl/node:lib ${nodeLib} --publishable --importPath=@proj/${nodeLib}`
      );
      checkFilesExist(`libs/${nodeLib}/package.json`);
      const tslibConfig = readJson(`libs/${nodeLib}/tsconfig.lib.json`);
      expect(tslibConfig).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'commonjs',
          outDir: '../../dist/out-tsc',
          declaration: true,
          types: ['node'],
        },
        exclude: ['**/*.spec.ts'],
        include: ['**/*.ts'],
      });
      await runCLIAsync(`build ${nodeLib}`);
      checkFilesExist(
        `dist/libs/${nodeLib}/src/index.js`,
        `dist/libs/${nodeLib}/src/index.d.ts`,
        `dist/libs/${nodeLib}/package.json`
      );

      const packageJson = readJson(`dist/libs/${nodeLib}/package.json`);
      expect(packageJson).toEqual({
        name: `@proj/${nodeLib}`,
        version: '0.0.1',
        main: 'src/index.js',
        typings: 'src/index.d.ts',
      });
    }, 60000);

    it('should be able to copy assets', () => {
      ensureProject();
      const nodelib = uniq('nodelib');
      const nglib = uniq('nglib');

      // Generating two libraries just to have a lot of files to copy
      runCLI(
        `generate @nrwl/node:lib ${nodelib} --publishable --importPath=@proj/${nodelib}`
      );
      /**
       * The angular lib contains a lot sub directories that would fail without
       * `nodir: true` in the package.impl.ts
       */
      runCLI(
        `generate @nrwl/angular:lib ${nglib} --publishable --importPath=@proj/${nglib}`
      );
      const workspace = readJson(workspaceConfigName());
      workspace.projects[nodelib].architect.build.options.assets.push({
        input: `./dist/libs/${nglib}`,
        glob: '**/*',
        output: '.',
      });

      updateFile(workspaceConfigName(), JSON.stringify(workspace));

      runCLI(`build ${nglib}`);
      runCLI(`build ${nodelib}`);
      checkFilesExist(`./dist/libs/${nodelib}/esm2015/index.js`);
    }, 60000);
  });

  describe('nest libraries', function () {
    it('should be able to generate a nest library', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib}`);

      const jestConfigContent = readFile(`libs/${nestlib}/jest.config.js`);

      expect(stripIndents`${jestConfigContent}`).toEqual(
        stripIndents`module.exports = {
                name: '${nestlib}',
                preset: '../../jest.config.js',
                globals: {
                  'ts-jest': {
                  tsConfig: '<rootDir>/tsconfig.spec.json',
                  },
                },
                testEnvironment: 'node',
                 transform: {
                '^.+\\.[tj]sx?$': 'ts-jest',
                },
                moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
                coverageDirectory: '../../coverage/libs/${nestlib}',
            };
            `
      );

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');
    }, 60000);

    it('should be able to generate a nest library w/ service', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib} --service`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 60000);

    it('should be able to generate a nest library w/ controller', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib} --controller`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 60000);

    it('should be able to generate a nest library w/ controller and service', async () => {
      ensureProject();
      const nestlib = uniq('nestlib');

      runCLI(`generate @nrwl/nest:lib ${nestlib} --controller --service`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('All files pass linting.');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );
    }, 60000);
  });

  describe('with dependencies', () => {
    /**
     * Graph:
     *
     *                     childLib
     *                   /
     * app => parentLib =>
     *                  \
     *                   \
     *                    childLib2
     *
     */
    let app: string;
    let parentLib: string;
    let childLib: string;
    let childLib2: string;

    beforeEach(() => {
      app = uniq('app');
      parentLib = uniq('parentlib');
      childLib = uniq('childlib');
      childLib2 = uniq('childlib2');

      ensureProject();

      runCLI(`generate @nrwl/express:app ${app}`);
      runCLI(`generate @nrwl/node:lib ${parentLib} --buildable=true`);
      runCLI(`generate @nrwl/node:lib ${childLib} --buildable=true`);
      runCLI(`generate @nrwl/node:lib ${childLib2} --buildable=true`);

      // create dependencies by importing
      const createDep = (parent, children: string[]) => {
        updateFile(
          `libs/${parent}/src/lib/${parent}.ts`,
          `
                ${children
                  .map((entry) => `import { ${entry} } from '@proj/${entry}';`)
                  .join('\n')}

                export function ${parent}(): string {
                  return '${parent}' + ' ' + ${children
            .map((entry) => `${entry}()`)
            .join('+')}
                }
                `
        );
      };

      createDep(parentLib, [childLib, childLib2]);

      updateFile(
        `apps/${app}/src/main.ts`,
        `
        import "@proj/${parentLib}";
        `
      );

      // we are setting paths to {} to make sure built libs are read from dist
      updateFile('tsconfig.base.json', (c) => {
        const json = JSON.parse(c);
        json.compilerOptions.paths = {};
        return JSON.stringify(json, null, 2);
      });
    });

    it('should throw an error if the dependent library has not been built before building the parent lib', () => {
      expect.assertions(2);

      try {
        runCLI(`build ${parentLib}`);
      } catch (e) {
        expect(e.stderr.toString()).toContain(
          `Some of the project ${parentLib}'s dependencies have not been built yet. Please build these libraries before:`
        );
        expect(e.stderr.toString()).toContain(`${childLib}`);
      }
    });

    it('should build a library without dependencies', () => {
      const childLibOutput = runCLI(`build ${childLib}`);

      expect(childLibOutput).toContain(
        `Done compiling TypeScript files for library ${childLib}`
      );
    });

    it('should build a parent library if the dependent libraries have been built before', () => {
      const childLibOutput = runCLI(`build ${childLib}`);
      expect(childLibOutput).toContain(
        `Done compiling TypeScript files for library ${childLib}`
      );

      const childLib2Output = runCLI(`build ${childLib2}`);
      expect(childLib2Output).toContain(
        `Done compiling TypeScript files for library ${childLib2}`
      );

      const parentLibOutput = runCLI(`build ${parentLib}`);
      expect(parentLibOutput).toContain(
        `Done compiling TypeScript files for library ${parentLib}`
      );

      //   assert package.json deps have been set
      const assertPackageJson = (
        parent: string,
        lib: string,
        version: string
      ) => {
        const jsonFile = readJson(`dist/libs/${parent}/package.json`);
        const childDependencyVersion = jsonFile.dependencies[`@proj/${lib}`];
        expect(childDependencyVersion).toBe(version);
      };

      assertPackageJson(parentLib, childLib, '0.0.1');
      assertPackageJson(parentLib, childLib2, '0.0.1');
    });

    if (currentCLIName === 'nx') {
      it('should build an app composed out of buildable libs', () => {
        const buildWithDeps = runCLI(`build ${app} --with-deps`);
        expect(buildWithDeps).toContain(`Running target "build" succeeded`);
        checkFilesDoNotExist(`apps/${app}/tsconfig/tsconfig.nx-tmp`);

        // we remove all path mappings from the root tsconfig, so when trying to build
        // libs from source, the builder will throw
        const failedBuild = runCLI(
          `build ${app} --with-deps --buildLibsFromSource`,
          { silenceError: true }
        );
        expect(failedBuild).toContain(`Can't resolve`);
      }, 1000000);
    }
  });
});
