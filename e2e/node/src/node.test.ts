import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  expectJestTestsToPass,
  killPorts,
  newProject,
  packageInstall,
  promisifiedTreeKill,
  readFile,
  removeFile,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { exec, execSync } from 'child_process';
import * as http from 'http';

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

      packageInstall('@nestjs/swagger', undefined, '~5.0.0');

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

describe('nest libraries', function () {
  beforeEach(() => newProject());

  it('should be able to generate a nest library', async () => {
    const nestlib = uniq('nestlib');
    runCLI(`generate @nrwl/nest:lib ${nestlib}`);

    const jestConfigContent = readFile(`libs/${nestlib}/jest.config.ts`);

    expect(stripIndents`${jestConfigContent}`).toEqual(
      stripIndents`/* eslint-disable */
              export default {
                displayName: '${nestlib}',
                preset: '../../jest.preset.js',
                globals: {
                  'ts-jest': {
                  tsconfig: '<rootDir>/tsconfig.spec.json',
                  },
                },
                testEnvironment: 'node',
                 transform: {
                '^.+\\.[tj]s$': 'ts-jest',
                },
                moduleFileExtensions: ['ts', 'js', 'html'],
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

  it('should have plugin output if specified in `transformers`', async () => {
    newProject();
    const nestlib = uniq('nestlib');
    runCLI(`generate @nrwl/nest:lib ${nestlib} --buildable`);

    packageInstall('@nestjs/swagger', undefined, '~5.0.0');

    updateProjectConfig(nestlib, (config) => {
      config.targets.build.options.transformers = [
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

  it('should support workspaces w/o workspace config file', async () => {
    removeFile('workspace.json');
    const app2 = uniq('app2');
    runCLI(`generate @nrwl/node:app ${app2} --directory=myDir`);

    runCLI(`build my-dir-${app2}`);
    expect(() =>
      checkFilesDoNotExist('workspace.json', 'angular.json')
    ).not.toThrow();
  }, 1000000);

  it('should run default jest tests', async () => {
    await expectJestTestsToPass('@nrwl/node:lib');
  }, 100000);
});
