import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { exec, execSync } from 'child_process';
import * as http from 'http';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  createFile,
  killPorts,
  newProject,
  packageInstall,
  promisifiedTreeKill,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { accessSync, constants } from 'fs-extra';

function getData(port): Promise<any> {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}/api`, (res) => {
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

describe('Node Applications', () => {
  beforeEach(() => newProject());

  it('should be able to generate an empty application', async () => {
    const nodeapp = uniq('nodeapp');

    runCLI(`generate @nrwl/node:app ${nodeapp} --linter=eslint`);

    const lintResults = runCLI(`lint ${nodeapp}`);
    expect(lintResults).toContain('All files pass linting.');

    updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
    await runCLIAsync(`build ${nodeapp}`);

    checkFilesExist(`dist/apps/${nodeapp}/main.js`);
    const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('Hello World!');
  }, 300000);

  it('should be able to generate the correct outputFileName in options', async () => {
    const nodeapp = uniq('nodeapp');
    runCLI(`generate @nrwl/node:app ${nodeapp} --linter=eslint`);

    updateProjectConfig(nodeapp, (config) => {
      config.targets.build.options.outputFileName = 'index.js';
      return config;
    });

    await runCLIAsync(`build ${nodeapp}`);
    checkFilesExist(`dist/apps/${nodeapp}/index.js`);
  }, 300000);

  // TODO: This test fails in CI, but succeeds locally. It should be re-enabled once the reasoning is understood.
  xit('should be able to generate an empty application with standalone configuration', async () => {
    const nodeapp = uniq('nodeapp');

    runCLI(
      `generate @nrwl/node:app ${nodeapp} --linter=eslint --standaloneConfig`
    );

    updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
    await runCLIAsync(`build ${nodeapp}`);

    checkFilesExist(`dist/apps/${nodeapp}/main.js`);
    const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('Hello World!');
  }, 300000);

  it('should be able to generate an empty application with additional entries', async () => {
    const nodeapp = uniq('nodeapp');

    runCLI(`generate @nrwl/node:app ${nodeapp} --linter=eslint`);

    const lintResults = runCLI(`lint ${nodeapp}`);
    expect(lintResults).toContain('All files pass linting.');

    updateProjectConfig(nodeapp, (config) => {
      config.targets.build.options.additionalEntryPoints = [
        {
          entryName: 'additional-main',
          entryPath: `apps/${nodeapp}/src/additional-main.ts`,
        },
      ];
      return config;
    });

    updateFile(
      `apps/${nodeapp}/src/additional-main.ts`,
      `console.log('Hello Additional World!');`
    );
    updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
    await runCLIAsync(`build ${nodeapp}`);

    checkFilesExist(
      `dist/apps/${nodeapp}/main.js`,
      `dist/apps/${nodeapp}/additional-main.js`
    );
    const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('Hello World!');

    const additionalResult = execSync(
      `node dist/apps/${nodeapp}/additional-main.js`,
      {
        cwd: tmpProjPath(),
      }
    ).toString();
    expect(additionalResult).toContain('Hello Additional World!');
  }, 60000);

  xit('should be able to generate an express application', async () => {
    const nodeapp = uniq('nodeapp');
    const port = 3334;

    runCLI(`generate @nrwl/express:app ${nodeapp} --linter=eslint`);
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

    // checking build
    const server = exec(`node ./dist/apps/${nodeapp}/main.js`, {
      cwd: tmpProjPath(),
    });

    await new Promise((resolve) => {
      server.stdout.on('data', async (data) => {
        expect(data.toString()).toContain(
          `Listening at http://localhost:${port}`
        );
        const result = await getData(port);

        expect(result.message).toEqual(`Welcome to ${nodeapp}!`);

        console.log('kill server');
        server.kill();
        resolve(null);
      });
    });
    // checking serve
    const p = await runCommandUntil(
      `serve ${nodeapp} --port=${port}`,
      (output) => output.includes(`Listening at http://localhost:${port}`)
    );
    const result = await getData(port);
    expect(result.message).toEqual(`Welcome to ${nodeapp}!`);
    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      expect(await killPorts(port)).toBeTruthy();
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 120000);

  xit('should be able to generate a nest application', async () => {
    const nestapp = uniq('nestapp');
    const port = 3335;
    runCLI(`generate @nrwl/nest:app ${nestapp} --linter=eslint`);

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

    const server = exec(`node ./dist/apps/${nestapp}/main.js`, {
      cwd: tmpProjPath(),
    });
    expect(server).toBeTruthy();

    // checking build
    await new Promise((resolve) => {
      server.stdout.on('data', async (data) => {
        const message = data.toString();
        if (message.includes(`Listening at http://localhost:${port}`)) {
          const result = await getData(port);

          expect(result.message).toEqual(`Welcome to ${nestapp}!`);
          server.kill();
          resolve(null);
        }
      });
    });

    // checking serve
    const p = await runCommandUntil(
      `serve ${nestapp} --port=${port}`,
      (output) => {
        process.stdout.write(output);
        return output.includes(`Listening at http://localhost:${port}`);
      }
    );
    const result = await getData(port);
    expect(result.message).toEqual(`Welcome to ${nestapp}!`);
    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      expect(await killPorts(port)).toBeTruthy();
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 120000);
});

describe('Build Node apps', () => {
  beforeEach(() => newProject());

  it('should generate a package.json with the `--generatePackageJson` flag', async () => {
    newProject();
    const nestapp = uniq('nestapp');
    runCLI(`generate @nrwl/nest:app ${nestapp} --linter=eslint`);

    await runCLIAsync(`build ${nestapp} --generatePackageJson`);

    checkFilesExist(`dist/apps/${nestapp}/package.json`);
    const packageJson = JSON.parse(
      readFile(`dist/apps/${nestapp}/package.json`)
    );
    expect(packageJson).toEqual(
      expect.objectContaining({
        dependencies: {
          '@nestjs/common': '^8.0.0',
          '@nestjs/core': '^8.0.0',
          '@nestjs/platform-express': '^8.0.0',
          'reflect-metadata': '^0.1.13',
          rxjs: '^7.0.0',
        },
        main: 'main.js',
        name: expect.any(String),
        version: '0.0.1',
      })
    );
  }, 300000);

  describe('NestJS', () => {
    it('should have plugin output if specified in `tsPlugins`', async () => {
      newProject();
      const nestapp = uniq('nestapp');
      runCLI(`generate @nrwl/nest:app ${nestapp} --linter=eslint`);

      // TODO: update to v5 when Nest8 is supported
      packageInstall('@nestjs/swagger', undefined, '4.8.2');

      updateProjectConfig(nestapp, (config) => {
        config.targets.build.options.tsPlugins = ['@nestjs/swagger/plugin'];
        return config;
      });

      updateFile(
        `apps/${nestapp}/src/app/foo.dto.ts`,
        `
export class FooDto {
  foo: string;
  bar: number;
}`
      );
      updateFile(
        `apps/${nestapp}/src/app/app.controller.ts`,
        `
import { Controller, Get } from '@nestjs/common';
import { FooDto } from './foo.dto';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('foo')
  getFoo(): Promise<FooDto> {
    return Promise.resolve({
      foo: 'foo',
      bar: 123
    })
  }
}`
      );

      await runCLIAsync(`build ${nestapp}`);

      const mainJs = readFile(`dist/apps/${nestapp}/main.js`);
      expect(stripIndents`${mainJs}`).toContain(
        stripIndents`
class FooDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { foo: { required: true, type: () => String }, bar: { required: true, type: () => Number } };
    }
}
exports.FooDto = FooDto;
        `
      );
    }, 300000);
  });
});

describe('Node Libraries', () => {
  it('should be able to generate a node library', async () => {
    newProject();
    const nodelib = uniq('nodelib');

    runCLI(`generate @nrwl/node:lib ${nodelib}`);

    const lintResults = runCLI(`lint ${nodelib}`);
    expect(lintResults).toContain('All files pass linting.');

    const jestResult = await runCLIAsync(`test ${nodelib}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

    checkFilesDoNotExist(`libs/${nodelib}/package.json`);
  }, 300000);

  it('should be able to generate a publishable node library', async () => {
    const proj = newProject();

    const nodeLib = uniq('nodelib');
    runCLI(
      `generate @nrwl/node:lib ${nodeLib} --publishable --importPath=@${proj}/${nodeLib}`
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
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      include: ['**/*.ts'],
    });
    await runCLIAsync(`build ${nodeLib}`);
    checkFilesExist(
      `dist/libs/${nodeLib}/src/index.js`,
      `dist/libs/${nodeLib}/src/index.d.ts`,
      `dist/libs/${nodeLib}/package.json`
    );

    expect(readJson(`dist/libs/${nodeLib}/package.json`)).toEqual({
      name: `@${proj}/${nodeLib}`,
      version: '0.0.1',
      main: './src/index.js',
      typings: './src/index.d.ts',
    });

    // Copying package.json from assets
    updateProjectConfig(nodeLib, (config) => {
      config.targets.build.options.assets.push(`libs/${nodeLib}/package.json`);
      return config;
    });
    createFile(`dist/libs/${nodeLib}/_should_remove.txt`); // Output directory should be removed
    await runCLIAsync(`build ${nodeLib}`);
    expect(readJson(`dist/libs/${nodeLib}/package.json`)).toEqual({
      name: `@${proj}/${nodeLib}`,
      version: '0.0.1',
      main: './src/index.js',
      typings: './src/index.d.ts',
    });
  }, 300000);

  it('should be able to generate a publishable node library with CLI wrapper', async () => {
    const proj = newProject();

    const nodeLib = uniq('nodelib');
    runCLI(
      `generate @nrwl/node:lib ${nodeLib} --publishable --importPath=@${proj}/${nodeLib}`
    );

    updateProjectConfig(nodeLib, (config) => {
      config.targets.build.options.cli = true;
      return config;
    });

    await runCLIAsync(`build ${nodeLib}`);

    const binFile = `dist/libs/${nodeLib}/index.bin.js`;
    checkFilesExist(binFile);
    expect(() =>
      accessSync(tmpProjPath(binFile), constants.X_OK)
    ).not.toThrow();

    expect(readJson(`dist/libs/${nodeLib}/package.json`).bin).toEqual({
      [nodeLib]: './index.bin.js',
    });
    checkFilesDoNotExist(`dist/libs/${nodeLib}/_should_remove.txt`);

    // Support not deleting output path before build
    createFile(`dist/libs/${nodeLib}/_should_keep.txt`);
    await runCLIAsync(`build ${nodeLib} --delete-output-path=false`);
    checkFilesExist(`dist/libs/${nodeLib}/_should_keep.txt`);
  }, 300000);

  it('should support --js flag', async () => {
    const proj = newProject();

    const nodeLib = uniq('nodelib');
    runCLI(
      `generate @nrwl/node:lib ${nodeLib} --publishable --importPath=@${proj}/${nodeLib} --js`
    );
    checkFilesExist(
      `libs/${nodeLib}/package.json`,
      `libs/${nodeLib}/src/index.js`,
      `libs/${nodeLib}/src/lib/${nodeLib}.js`,
      `libs/${nodeLib}/src/lib/${nodeLib}.spec.js`
    );
    checkFilesDoNotExist(
      `libs/${nodeLib}/src/index.ts`,
      `libs/${nodeLib}/src/lib/${nodeLib}.ts`,
      `libs/${nodeLib}/src/lib/${nodeLib}.spec.ts`
    );
    await runCLIAsync(`build ${nodeLib}`);
    checkFilesExist(
      `dist/libs/${nodeLib}/src/index.js`,
      `dist/libs/${nodeLib}/package.json`
    );
  }, 300000);

  it('should be able to copy assets', () => {
    const proj = newProject();
    const nodelib = uniq('nodelib');
    const nglib = uniq('nglib');

    // Generating two libraries just to have a lot of files to copy
    runCLI(
      `generate @nrwl/node:lib ${nodelib} --publishable --importPath=@${proj}/${nodelib}`
    );
    /**
     * The angular lib contains a lot sub directories that would fail without
     * `nodir: true` in the package.impl.ts
     */
    runCLI(
      `generate @nrwl/angular:lib ${nglib} --publishable --importPath=@${proj}/${nglib}`
    );

    updateProjectConfig(nodelib, (config) => {
      config.targets.build.options.assets.push({
        input: `./dist/libs/${nglib}`,
        glob: '**/*',
        output: '.',
      });
      return config;
    });

    runCLI(`build ${nglib}`);
    runCLI(`build ${nodelib}`);
    checkFilesExist(`./dist/libs/${nodelib}/esm2020/index.mjs`);
  }, 300000);

  it('should fail when trying to compile typescript files that are invalid', () => {
    const proj = newProject();
    const nodeLib = uniq('nodelib');
    runCLI(
      `generate @nrwl/node:lib ${nodeLib} --publishable --importPath=@${proj}/${nodeLib}`
    );
    updateFile(
      `libs/${nodeLib}/src/index.ts`,
      stripIndents`
        const temp: number = 'should fail'
        `
    );
    expect(() => runCLI(`build ${nodeLib}`)).toThrow();
  });
});

describe('nest libraries', function () {
  beforeEach(() => newProject());

  it('should be able to generate a nest library', async () => {
    const nestlib = uniq('nestlib');
    runCLI(`generate @nrwl/nest:lib ${nestlib}`);

    const jestConfigContent = readFile(`libs/${nestlib}/jest.config.js`);

    expect(stripIndents`${jestConfigContent}`).toEqual(
      stripIndents`module.exports = {
                displayName: '${nestlib}',
                preset: '../../jest.preset.js',
                globals: {
                  'ts-jest': {
                  tsconfig: '<rootDir>/tsconfig.spec.json',
                  },
                },
                testEnvironment: 'node',
                 transform: {
                '^.+\\.[tj]sx?$': 'ts-jest',
                },
                moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
                coverageDirectory: '../../coverage/libs/${nestlib}',
            };
            `
    );

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');
  }, 60000);

  it('should be able to generate a nest library w/ service', async () => {
    const nestlib = uniq('nestlib');

    runCLI(`generate @nrwl/nest:lib ${nestlib} --service`);

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');

    const jestResult = await runCLIAsync(`test ${nestlib}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 200000);

  it('should be able to generate a nest library w/ controller', async () => {
    const nestlib = uniq('nestlib');

    runCLI(`generate @nrwl/nest:lib ${nestlib} --controller`);

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');

    const jestResult = await runCLIAsync(`test ${nestlib}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 200000);

  it('should be able to generate a nest library w/ controller and service', async () => {
    const nestlib = uniq('nestlib');

    runCLI(`generate @nrwl/nest:lib ${nestlib} --controller --service`);

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');

    const jestResult = await runCLIAsync(`test ${nestlib}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 2 passed, 2 total'
    );
  }, 200000);

  it('should have plugin output if specified in `tsPlugins`', async () => {
    newProject();
    const nestlib = uniq('nestlib');
    runCLI(`generate @nrwl/nest:lib ${nestlib} --buildable`);

    // TODO: update to v5 when Nest8 is supported
    packageInstall('@nestjs/swagger', undefined, '4.8.2');

    updateProjectConfig(nestlib, (config) => {
      config.targets.build.options.tsPlugins = [
        {
          name: '@nestjs/swagger/plugin',
          options: {
            dtoFileNameSuffix: ['.model.ts'],
          },
        },
      ];
      return config;
    });

    updateFile(
      `libs/${nestlib}/src/lib/foo.model.ts`,
      `
export class FooModel {
  foo: string;
  bar: number;
}`
    );

    await runCLIAsync(`build ${nestlib}`);

    const fooModelJs = readFile(`dist/libs/${nestlib}/src/lib/foo.model.js`);
    expect(stripIndents`${fooModelJs}`).toContain(
      stripIndents`
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FooModel = void 0;
const openapi = require("@nestjs/swagger");
class FooModel {
    static _OPENAPI_METADATA_FACTORY() {
        return { foo: { required: true, type: () => String }, bar: { required: true, type: () => Number } };
    }
}
exports.FooModel = FooModel;
//# sourceMappingURL=foo.model.js.map
        `
    );
  }, 300000);
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
  let proj: string;

  beforeEach(() => {
    app = uniq('app');
    parentLib = uniq('parentlib');
    childLib = uniq('childlib');
    childLib2 = uniq('childlib2');

    proj = newProject();

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
                  .map(
                    (entry) => `import { ${entry} } from '@${proj}/${entry}';`
                  )
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
        import "@${proj}/${parentLib}";
        `
    );

    // we are setting paths to {} to make sure built libs are read from dist
    updateFile('tsconfig.base.json', (c) => {
      const json = JSON.parse(c);
      json.compilerOptions.paths = {};
      return JSON.stringify(json, null, 2);
    });
  });

  it('should build a library without dependencies', () => {
    const childLibOutput = runCLI(`build ${childLib}`);

    expect(childLibOutput).toContain(
      `Done compiling TypeScript files for project "${childLib}"`
    );
  });

  it('should build a parent library if the dependent libraries have been built before', () => {
    const childLibOutput = runCLI(`build ${childLib}`);
    expect(childLibOutput).toContain(
      `Done compiling TypeScript files for project "${childLib}"`
    );

    const childLib2Output = runCLI(`build ${childLib2}`);
    expect(childLib2Output).toContain(
      `Done compiling TypeScript files for project "${childLib2}"`
    );

    const parentLibOutput = runCLI(`build ${parentLib}`);
    expect(parentLibOutput).toContain(
      `Done compiling TypeScript files for project "${parentLib}"`
    );

    //   assert package.json deps have been set
    const assertPackageJson = (
      parent: string,
      lib: string,
      version: string
    ) => {
      const jsonFile = readJson(`dist/libs/${parent}/package.json`);
      const childDependencyVersion = jsonFile.dependencies[`@${proj}/${lib}`];
      expect(childDependencyVersion).toBe(version);
    };

    assertPackageJson(parentLib, childLib, '0.0.1');
    assertPackageJson(parentLib, childLib2, '0.0.1');
  });

  it('should build an app composed out of buildable libs', () => {
    const buildWithDeps = runCLI(
      `build ${app} --with-deps --buildLibsFromSource=false`
    );
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
});
