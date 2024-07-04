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
} from '@nx/e2e/utils';
import { exec, execSync } from 'child_process';
import * as http from 'http';
import { getLockFileName } from '@nx/js';
import { satisfies } from 'semver';
import { join } from 'path';

let originalEnvPort;

function getRandomPort() {
  return Math.floor(1000 + Math.random() * 9000);
}

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
  beforeAll(() => {
    originalEnvPort = process.env.PORT;
    newProject({
      packages: ['@nx/node', '@nx/express', '@nx/nest'],
    });
  });

  afterAll(() => {
    process.env.PORT = originalEnvPort;
    cleanupProject();
  });

  it('should be able to generate an empty application', async () => {
    const nodeapp = uniq('nodeapp');
    const port = getRandomPort();
    process.env.PORT = `${port}`;
    runCLI(`generate @nx/node:app ${nodeapp} --port=${port} --linter=eslint`);

    const lintResults = runCLI(`lint ${nodeapp}`);
    expect(lintResults).toContain('Successfully ran target lint');

    updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
    await runCLIAsync(`build ${nodeapp}`);

    checkFilesExist(`dist/apps/${nodeapp}/main.js`);
    const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('Hello World!');
    await killPorts(port);
  }, 300000);

  // TODO(crystal, @ndcunningham): This does not work because NxWebpackPlugin({}) outputFilename does not work.
  xit('should be able to generate the correct outputFileName in options', async () => {
    const nodeapp = uniq('nodeapp');
    runCLI(`generate @nx/node:app ${nodeapp} --linter=eslint`);

    updateJson(join('apps', nodeapp, 'project.json'), (config) => {
      config.targets.build.options.outputFileName = 'index.js';
      return config;
    });

    await runCLIAsync(`build ${nodeapp}`);
    checkFilesExist(`dist/apps/${nodeapp}/index.js`);
  }, 300000);

  it('should be able to generate an empty application with additional entries', async () => {
    const nodeapp = uniq('nodeapp');
    const port = getRandomPort();
    process.env.PORT = `${port}`;
    runCLI(
      `generate @nx/node:app ${nodeapp} --port=${port} --linter=eslint --bundler=webpack`
    );

    const lintResults = runCLI(`lint ${nodeapp}`);
    expect(lintResults).toContain('Successfully ran target lint');

    updateFile(
      `apps/${nodeapp}/webpack.config.js`,
      `
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/${nodeapp}'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      additionalEntryPoints: [
        {
          entryPath: 'apps/${nodeapp}/src/additional-main.ts',
          entryName: 'additional-main',
        }
      ],
      optimization: false,
      outputHashing: 'none',
    }),
  ],
};
     `
    );

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

    await killPorts(port);
  }, 300_000);

  it('should be able to generate an empty application with variable in .env file', async () => {
    const originalEnvPort = process.env.PORT;
    const port = 3457;
    process.env.PORT = `${port}`;
    const nodeapp = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app ${nodeapp} --linter=eslint --bundler=webpack --framework=none`
    );

    updateFile('.env', `NX_FOOBAR="test foo bar"`);

    updateFile(
      `apps/${nodeapp}/src/main.ts`,
      `console.log('foobar: ' + process.env['NX_FOOBAR']);`
    );

    await runCLIAsync(`build ${nodeapp}`);
    checkFilesExist(`dist/apps/${nodeapp}/main.js`);

    // check serving
    const p = await runCommandUntil(
      `serve ${nodeapp} --port=${port} --watch=false`,
      (output) => {
        process.stdout.write(output);
        return output.includes(`foobar: test foo bar`);
      },
      {
        env: {
          NX_DAEMON: 'true',
        },
      }
    );
    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
    } finally {
      process.env.port = originalEnvPort;
    }
  }, 60000);

  it("should exclude 'test' target from e2e project that uses jest", async () => {
    const appName = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app ${appName} --project-name-and-root-format=as-provided --no-interactive`
    );

    const nxJson = JSON.parse(readFile('nx.json'));
    expect(nxJson.plugins).toBeDefined();

    const jestPlugin = nxJson.plugins.find(
      (p) => p.plugin === '@nx/jest/plugin'
    );
    expect(jestPlugin).toBeDefined();
    expect(jestPlugin.exclude).toContain(`${appName}-e2e/**/*`);
  });

  it('should be able to generate an express application', async () => {
    const nodeapp = uniq('nodeapp');
    const originalEnvPort = process.env.PORT;
    const port = 3499;
    process.env.PORT = `${port}`;

    runCLI(
      `generate @nx/express:app ${nodeapp} --port=${port} --linter=eslint`
    );

    const lintResults = runCLI(`lint ${nodeapp}`);
    expect(lintResults).toContain('Successfully ran target lint');

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
    const p = await runCommandUntil(
      `serve ${nodeapp}`,
      (output) => output.includes(`Listening at http://localhost:${port}`),

      {
        env: {
          NX_DAEMON: 'true',
        },
      }
    );

    let result = await getData(port);
    expect(result.message).toMatch(`Welcome to ${nodeapp}!`);

    result = await getData(port, '/assets/file.txt');
    expect(result).toMatch(`Test`);

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      expect(await killPorts(port)).toBeTruthy();
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 120_000);

  it('should be able to generate a nest application', async () => {
    const nestapp = uniq('nestapp');
    const port = 3335;
    runCLI(`generate @nx/nest:app ${nestapp} --linter=eslint`);

    const lintResults = runCLI(`lint ${nestapp}`);
    expect(lintResults).toContain('Successfully ran target lint');

    updateFile(`apps/${nestapp}/src/assets/file.txt`, ``);
    const jestResult = await runCLIAsync(`test ${nestapp}`);
    expect(jestResult.combinedOutput).toContain(
      'Test Suites: 2 passed, 2 total'
    );

    const buildResult = runCLI(`build ${nestapp}`);

    checkFilesExist(
      `dist/apps/${nestapp}/main.js`,
      `dist/apps/${nestapp}/assets/file.txt`
    );

    expect(buildResult).toContain(
      `Successfully ran target build for project ${nestapp}`
    );

    // checking serve
    const p = await runCommandUntil(
      `serve ${nestapp} --port=${port}`,
      (output) => {
        process.stdout.write(output);
        return output.includes(`listening on ws://localhost:${port}`);
      },
      {
        env: {
          NX_DAEMON: 'true',
        },
      }
    );

    const e2eRsult = await runCLIAsync(`e2e ${nestapp}-e2e`);

    expect(e2eRsult.combinedOutput).toContain('Test Suites: 1 passed, 1 total');

    await killPorts(port);
    await promisifiedTreeKill(p.pid, 'SIGKILL');
  }, 120000);

  // TODO(crystal, @ndcunningham): how do we handle this now?
  // Revisit when NxWebpackPlugin({}) outputFilename is working.
  xit('should be able to run ESM applications', async () => {
    const esmapp = uniq('esmapp');

    runCLI(
      `generate @nrwl/node:app ${esmapp} --linter=eslint --framework=none --bundler=webpack`
    );
    updateJson(`apps/${esmapp}/tsconfig.app.json`, (config) => {
      config.module = 'esnext';
      config.target = 'es2020';
      return config;
    });
    updateJson(join('apps', esmapp, 'project.json'), (config) => {
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
    const p = await runCommandUntil(
      `serve ${esmapp}`,
      (output) => {
        return output.includes('Hello World');
      },
      {
        env: {
          NX_DAEMON: 'true',
        },
      }
    );
    await promisifiedTreeKill(p.pid, 'SIGKILL');
  }, 300000);
});

describe('Build Node apps', () => {
  let scope: string;
  beforeAll(() => {
    originalEnvPort = process.env.PORT;
    scope = newProject({
      packages: ['@nx/node', '@nx/express', '@nx/nest'],
    });
  });

  afterAll(() => {
    process.env.PORT = originalEnvPort;
    cleanupProject();
  });

  // TODO(crystal, @ndcunningham): What is the alternative here?
  xit('should generate a package.json with the `--generatePackageJson` flag', async () => {
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

    const port = getRandomPort();
    process.env.PORT = `${port}`;

    runCLI(`generate @nx/node:app ${appName} --port=${port} --no-interactive`);

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

  it('should support generating projects with the new name and root format', () => {
    const appName = uniq('app1');
    const libName = uniq('@my-org/lib1');

    const port = getRandomPort();
    process.env.PORT = `${port}`;

    runCLI(
      `generate @nx/node:app ${appName} --project-name-and-root-format=as-provided --port=${port} --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/main.ts`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName} --passWithNoTests`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );

    // assert scoped project names are not supported when --project-name-and-root-format=derived
    expect(() =>
      runCLI(
        `generate @nx/node:lib ${libName} --buildable --project-name-and-root-format=derived --no-interactive`
      )
    ).toThrow();

    runCLI(
      `generate @nx/node:lib ${libName} --buildable --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("libs/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${libName}/src/index.ts`);
    // check build works
    expect(runCLI(`build ${libName}`)).toContain(
      `Successfully ran target build for project ${libName}`
    );
    // check tests pass
    const libTestResult = runCLI(`test ${libName}`);
    expect(libTestResult).toContain(
      `Successfully ran target test for project ${libName}`
    );
  }, 500_000);

  // TODO(crystal, @ndcunningnam): Investigate why these tests are failing
  xdescribe('NestJS', () => {
    // TODO(crystal, @ndcunningham): What is the alternative here?
    xit('should have plugin output if specified in `tsPlugins`', async () => {
      const nestapp = uniq('nestapp');
      runCLI(`generate @nx/nest:app ${nestapp} --linter=eslint`);

      packageInstall('@nestjs/swagger', undefined, '^7.0.0');

      updateJson(join('apps', nestapp, 'project.json'), (config) => {
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

  describe('nest libraries', function () {
    it('should be able to generate a nest library', async () => {
      const nestlib = uniq('nestlib');
      runCLI(`generate @nx/nest:lib ${nestlib}`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('Successfully ran target lint');

      const testResults = runCLI(`test ${nestlib} --passWithNoTests`);
      expect(testResults).toContain(
        `Successfully ran target test for project ${nestlib}`
      );
    }, 60000);

    it('should be able to generate a nest library w/ service', async () => {
      const nestlib = uniq('nestlib');

      runCLI(`generate @nx/nest:lib ${nestlib} --service`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('Successfully ran target lint');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 200000);

    it('should be able to generate a nest library w/ controller', async () => {
      const nestlib = uniq('nestlib');

      runCLI(`generate @nx/nest:lib ${nestlib} --controller`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('Successfully ran target lint');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 1 passed, 1 total'
      );
    }, 200000);

    it('should be able to generate a nest library w/ controller and service', async () => {
      const nestlib = uniq('nestlib');

      runCLI(`generate @nx/nest:lib ${nestlib} --controller --service`);

      const lintResults = runCLI(`lint ${nestlib}`);
      expect(lintResults).toContain('Successfully ran target lint');

      const jestResult = await runCLIAsync(`test ${nestlib}`);
      expect(jestResult.combinedOutput).toContain(
        'Test Suites: 2 passed, 2 total'
      );
    }, 200000);

    it('should have plugin output if specified in `transformers`', async () => {
      const nestlib = uniq('nestlib');
      runCLI(`generate @nx/nest:lib ${nestlib} --buildable`);

      packageInstall('@nestjs/swagger', undefined, '^7.0.0');

      updateJson(join('libs', nestlib, 'project.json'), (config) => {
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
});
