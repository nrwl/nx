import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { joinPathFragments } from '@nx/devkit';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  detectPackageManager,
  expectJestTestsToPass,
  getPackageManagerCommand,
  killPorts,
  newProject,
  packageInstall,
  packageManagerLockFile,
  promisifiedTreeKill,
  readFile,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  updateProjectConfig,
} from '@nx/e2e/utils';
import { exec, execSync } from 'child_process';
import * as http from 'http';
import { getLockFileName } from '@nx/js';
import { satisfies } from 'semver';

function getData(port, path = '/api'): Promise<any> {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      expect(res.statusCode).toEqual(200);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.once('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
  });
}

describe('Node Applications', () => {
  beforeEach(() => newProject());

  afterEach(() => cleanupProject());

  it('should be able to generate an empty application', async () => {
    const nodeapp = uniq('nodeapp');

    runCLI(`generate @nx/node:app ${nodeapp} --linter=eslint`);

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
    runCLI(`generate @nx/node:app ${nodeapp} --linter=eslint`);

    updateProjectConfig(nodeapp, (config) => {
      config.targets.build.options.outputFileName = 'index.js';
      return config;
    });

    await runCLIAsync(`build ${nodeapp}`);
    checkFilesExist(`dist/apps/${nodeapp}/index.js`);
  }, 300000);

  it('should be able to generate an empty application with additional entries', async () => {
    const nodeapp = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app ${nodeapp} --linter=eslint --bundler=webpack`
    );

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
    updateFile(
      `apps/${nodeapp}/src/main.ts`,
      `console.log('Hello World!');
    console.log('env: ' + process.env['NODE_ENV']);
    `
    );

    await runCLIAsync(`build ${nodeapp}`);

    checkFilesExist(
      `dist/apps/${nodeapp}/main.js`,
      `dist/apps/${nodeapp}/additional-main.js`
    );

    const result = execSync(
      `NODE_ENV=development && node dist/apps/${nodeapp}/main.js`,
      {
        cwd: tmpProjPath(),
      }
    ).toString();
    expect(result).toContain('Hello World!');
    expect(result).toContain('env: development');

    const additionalResult = execSync(
      `node dist/apps/${nodeapp}/additional-main.js`,
      {
        cwd: tmpProjPath(),
      }
    ).toString();
    expect(additionalResult).toContain('Hello Additional World!');
  }, 60000);

  it('should be able to generate an express application', async () => {
    const nodeapp = uniq('nodeapp');
    const originalEnvPort = process.env.PORT;
    const port = 3456;
    process.env.PORT = `${port}`;

    runCLI(`generate @nx/express:app ${nodeapp} --linter=eslint`);
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

    const jestResult = runCLI(`test ${nodeapp}`);
    expect(jestResult).toContain('Successfully ran target test');

    // checking serve
    updateFile(`apps/${nodeapp}/src/assets/file.txt`, `Test`);
    const p = await runCommandUntil(`serve ${nodeapp}`, (output) =>
      output.includes(`Listening at http://localhost:${port}`)
    );

    let result = await getData(port);
    expect(result.message).toMatch(`Welcome to ${nodeapp}!`);

    result = await getData(port, '/assets/file.txt');
    expect(result).toMatch(`Test`);

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
    } finally {
      process.env.port = originalEnvPort;
    }
  }, 120_000);

  xit('should be able to generate a nest application', async () => {
    const nestapp = uniq('nestapp');
    const port = 3335;
    runCLI(`generate @nx/nest:app ${nestapp} --linter=eslint`);

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

  it('should be able to run ESM applications', async () => {
    const esmapp = uniq('esmapp');

    runCLI(
      `generate @nrwl/node:app ${esmapp} --linter=eslint --framework=none --bundler=webpack`
    );
    updateJson(`apps/${esmapp}/tsconfig.app.json`, (config) => {
      config.module = 'esnext';
      config.target = 'es2020';
      return config;
    });
    updateProjectConfig(esmapp, (config) => {
      config.targets.build.options.outputFileName = 'main.mjs';
      config.targets.build.options.assets = [];
      return config;
    });
    updateFile(
      `apps/${esmapp}/webpack.config.js`,
      `
        const { composePlugins, withNx } = require('@nx/webpack');
        module.exports = composePlugins(withNx(), (config) => {
          config.experiments = {
            ...config.experiments,
            outputModule: true,
            topLevelAwait: true,
          };
          config.output = {
            path: config.output.path,
            chunkFormat: 'module',
            library: { type: 'module' }
          }
          return config;
        });
      `
    );
    await runCLIAsync(`build ${esmapp}`);
    const p = await runCommandUntil(`serve ${esmapp}`, (output) => {
      return output.includes('Hello World');
    });
    p.kill();
  }, 300000);
});

describe('Build Node apps', () => {
  beforeEach(() => newProject());

  afterEach(() => cleanupProject());

  it('should generate a package.json with the `--generatePackageJson` flag', async () => {
    const scope = newProject();
    const packageManager = detectPackageManager(tmpProjPath());
    const nestapp = uniq('nestapp');
    runCLI(`generate @nx/nest:app ${nestapp} --linter=eslint`);

    await runCLIAsync(`build ${nestapp} --generatePackageJson`);

    checkFilesExist(`dist/apps/${nestapp}/package.json`);
    checkFilesExist(
      `dist/apps/${nestapp}/${getLockFileName(
        detectPackageManager(tmpProjPath())
      )}`
    );
    const rootPackageJson = JSON.parse(readFile(`package.json`));
    const packageJson = JSON.parse(
      readFile(`dist/apps/${nestapp}/package.json`)
    );
    expect(packageJson).toEqual(
      expect.objectContaining({
        main: 'main.js',
        name: expect.any(String),
        version: '0.0.1',
      })
    );

    expect(
      satisfies(
        packageJson.dependencies['@nestjs/common'],
        rootPackageJson.dependencies['@nestjs/common']
      )
    ).toBeTruthy();
    expect(
      satisfies(
        packageJson.dependencies['@nestjs/core'],
        rootPackageJson.dependencies['@nestjs/core']
      )
    ).toBeTruthy();
    expect(
      satisfies(
        packageJson.dependencies['reflect-metadata'],
        rootPackageJson.dependencies['reflect-metadata']
      )
    ).toBeTruthy();
    expect(
      satisfies(
        packageJson.dependencies['rxjs'],
        rootPackageJson.dependencies['rxjs']
      )
    ).toBeTruthy();
    expect(
      satisfies(
        packageJson.dependencies['tslib'],
        rootPackageJson.dependencies['tslib']
      )
    ).toBeTruthy();

    checkFilesExist(
      `dist/apps/${nestapp}/${packageManagerLockFile[packageManager]}`
    );
    runCommand(`${getPackageManagerCommand().ciInstall}`, {
      cwd: joinPathFragments(tmpProjPath(), 'dist/apps', nestapp),
    });

    const nodeapp = uniq('nodeapp');
    runCLI(`generate @nx/node:app ${nodeapp} --bundler=webpack`);

    const jslib = uniq('jslib');
    runCLI(`generate @nx/js:lib ${jslib} --bundler=tsc`);

    updateFile(
      `apps/${nodeapp}/src/main.ts`,
      `
import { ${jslib} } from '@${scope}/${jslib}';
console.log('Hello World!');
${jslib}();
`
    );

    const { combinedOutput: nodeCombinedOutput } = await runCLIAsync(
      `build ${nodeapp} --generate-package-json`
    );
    expect(nodeCombinedOutput).not.toMatch(/Graph is not consistent/);
    checkFilesExist(`dist/apps/${nodeapp}/package.json`);
    checkFilesExist(
      `dist/apps/${nodeapp}/${packageManagerLockFile[packageManager]}`
    );
    const nodeAppPackageJson = JSON.parse(
      readFile(`dist/apps/${nodeapp}/package.json`)
    );

    expect(nodeAppPackageJson['dependencies']['tslib']).toBeTruthy();

    runCommand(`${getPackageManagerCommand().ciInstall}`, {
      cwd: joinPathFragments(tmpProjPath(), 'dist/apps', nestapp),
    });

    runCommand(`${getPackageManagerCommand().ciInstall}`, {
      cwd: joinPathFragments(tmpProjPath(), 'dist/apps', nodeapp),
    });
  }, 1_000_000);

  it('should remove previous output before building with the --deleteOutputPath option set', async () => {
    const appName = uniq('app');

    runCLI(`generate @nx/node:app ${appName} --no-interactive`);

    // deleteOutputPath should default to true
    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName} --outputHashing none`); // no explicit deleteOutputPath option set
    checkFilesDoNotExist(`dist/apps/${appName}/_should_remove.txt`);
    checkFilesExist(`dist/apps/_should_not_remove.txt`);

    // Explicitly set `deleteOutputPath` to true
    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName} --outputHashing none --deleteOutputPath`);
    checkFilesDoNotExist(`dist/apps/${appName}/_should_remove.txt`);
    checkFilesExist(`dist/apps/_should_not_remove.txt`);

    // Explicitly set `deleteOutputPath` to false
    createFile(`dist/apps/${appName}/_should_keep.txt`);
    createFile(`dist/apps/_should_keep.txt`);
    runCLI(`build ${appName} --deleteOutputPath=false --outputHashing none`);
    checkFilesExist(`dist/apps/${appName}/_should_keep.txt`);
    checkFilesExist(`dist/apps/_should_keep.txt`);
  }, 120000);

  describe('NestJS', () => {
    it('should have plugin output if specified in `tsPlugins`', async () => {
      newProject();
      const nestapp = uniq('nestapp');
      runCLI(`generate @nx/nest:app ${nestapp} --linter=eslint`);

      packageInstall('@nestjs/swagger', undefined, '^6.0.0');

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
      expect(mainJs).toContain('FooDto');
      expect(mainJs).toContain('_OPENAPI_METADATA_FACTORY');
    }, 300000);
  });
});

describe('nest libraries', function () {
  beforeEach(() => newProject());

  it('should be able to generate a nest library', async () => {
    const nestlib = uniq('nestlib');
    runCLI(`generate @nx/nest:lib ${nestlib}`);

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');

    const testResults = runCLI(`test ${nestlib}`);
    expect(testResults).toContain(
      `Successfully ran target test for project ${nestlib}`
    );
  }, 60000);

  it('should be able to generate a nest library w/ service', async () => {
    const nestlib = uniq('nestlib');

    runCLI(`generate @nx/nest:lib ${nestlib} --service`);

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');

    const jestResult = await runCLIAsync(`test ${nestlib}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 200000);

  it('should be able to generate a nest library w/ controller', async () => {
    const nestlib = uniq('nestlib');

    runCLI(`generate @nx/nest:lib ${nestlib} --controller`);

    const lintResults = runCLI(`lint ${nestlib}`);
    expect(lintResults).toContain('All files pass linting.');

    const jestResult = await runCLIAsync(`test ${nestlib}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 200000);

  it('should be able to generate a nest library w/ controller and service', async () => {
    const nestlib = uniq('nestlib');

    runCLI(`generate @nx/nest:lib ${nestlib} --controller --service`);

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
    runCLI(`generate @nx/nest:lib ${nestlib} --buildable`);

    packageInstall('@nestjs/swagger', undefined, '~6.3.0');

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
  foo?: string;
  bar?: number;
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
        return { foo: { required: false, type: () => String }, bar: { required: false, type: () => Number } };
    }
}
exports.FooModel = FooModel;
//# sourceMappingURL=foo.model.js.map
        `
    );
  }, 300000);

  it('should run default jest tests', async () => {
    await expectJestTestsToPass('@nx/node:lib');
  }, 100000);
});
