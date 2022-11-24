import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  readJson,
  updateFile,
  expectJestTestsToPass,
  cleanupProject,
  readFile,
  checkFilesExist,
} from '@nrwl/e2e/utils';

describe('Jest', () => {
  beforeAll(() => {
    newProject({ name: uniq('proj-jest') });
  });

  afterAll(() => cleanupProject());

  it('should be able test projects using jest', async () => {
    await expectJestTestsToPass('@nrwl/workspace:lib');
    await expectJestTestsToPass('@nrwl/js:lib');
  }, 500000);

  it('should merge with jest config globals', async () => {
    const testGlobal = `'My Test Global'`;
    const mylib = uniq('mylib');
    const utilLib = uniq('util-lib');
    runCLI(`generate @nrwl/workspace:lib ${mylib} --unit-test-runner jest`);
    runCLI(
      `generate @nrwl/workspace:lib ${utilLib} --importPath=@global-fun/globals`
    );
    updateFile(
      `libs/${utilLib}/src/index.ts`,
      stripIndents`
      export function setup() {console.log('i am a global setup function')}
      export function teardown() {console.log('i am a global teardown function')}
    `
    );

    updateFile(`libs/${mylib}/src/lib/${mylib}.ts`, `export class Test { }`);

    updateFile(
      `libs/${mylib}/src/lib/${mylib}.spec.ts`,
      `
          test('can access jest global', () => {
            expect((global as any).testGlobal).toBe(${testGlobal});
          });
        `
    );

    updateFile(
      `libs/${mylib}/setup.ts`,
      stripIndents`
      const { registerTsProject } = require('nx/src/utils/register');
      const cleanup = registerTsProject('.', 'tsconfig.base.json');

      import {setup} from '@global-fun/globals';
      export default async function() {setup();}

      cleanup();
    `
    );

    updateFile(
      `libs/${mylib}/teardown.ts`,
      stripIndents`
      import { registerTsProject } from 'nx/src/utils/register';
      const cleanup = registerTsProject('.', 'tsconfig.base.json');

      import {teardown} from '@global-fun/globals';
      export default async function() {teardown();}
      cleanup();
    `
    );

    updateFile(
      `libs/${mylib}/jest.config.ts`,
      stripIndents`
          module.exports = {
            testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
            transform: {
              '^.+\\.(ts|js|html)$': 'ts-jest'
            },
            resolver: '@nrwl/jest/plugins/resolver',
            moduleFileExtensions: ['ts', 'js', 'html'],
            coverageReporters: ['html'],
            passWithNoTests: true,
            globals: { testGlobal: ${testGlobal} },
            globalSetup: '<rootDir>/setup.ts',
            globalTeardown: '<rootDir>/teardown.ts'
          };`
    );

    const appResult = await runCLIAsync(`test ${mylib} --no-watch`);
    expect(appResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 300000);

  it('should set the NODE_ENV to `test`', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${mylib} --unit-test-runner jest`);

    updateFile(
      `libs/${mylib}/src/lib/${mylib}.spec.ts`,
      `
        test('can access jest global', () => {
          expect(process.env.NODE_ENV).toBe('test');
        });
        `
    );
    const appResult = await runCLIAsync(`test ${mylib} --no-watch`);
    expect(appResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 90000);

  it('should support multiple `coverageReporters` through CLI', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${mylib} --unit-test-runner jest`);

    updateFile(
      `libs/${mylib}/src/lib/${mylib}.spec.ts`,
      `
        test('can access jest global', () => {
          expect(true).toBe(true);
        });
        `
    );

    const result = await runCLIAsync(
      `test ${mylib} --no-watch --code-coverage --coverageReporters=text --coverageReporters=text-summary`
    );
    expect(result.stdout).toContain(
      'File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s'
    ); // text
    expect(result.stdout).toContain('Coverage summary'); // text-summary
  }, 90000);

  it('should be able to test node lib with babel-jest', async () => {
    const libName = uniq('babel-test-lib');
    runCLI(
      `generate @nrwl/node:lib ${libName} --buildable --importPath=@some-org/babel-test --publishable --babelJest`
    );

    const cliResults = await runCLIAsync(`test ${libName}`);
    expect(cliResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 90000);
});

describe('Jest root projects MMM', () => {
  afterEach(() => cleanupProject());

  it('should set root project config to app and migrate when another lib is added', () => {
    const myapp = uniq('myapp');
    const mylib = uniq('mylib');

    newProject();
    runCLI(`generate @nrwl/react:app ${myapp} --rootProject=true`);

    expect(() => checkFilesExist('jest.config.ts')).not.toThrow();
    expect(() => checkFilesExist('jest.preset.js')).not.toThrow();
    const rootConfig = readFile('jest.config.ts');
    expect(rootConfig).not.toContain(`getJestProjects`);

    let rootProjectConfig = readJson('project.json');
    expect(rootProjectConfig.targets.test.options.jestConfig).toEqual(
      'jest.config.ts'
    );

    runCLI(`generate @nrwl/react:lib ${mylib}`);

    const newName = `jest.config.${myapp}.ts`;
    expect(() => checkFilesExist(newName)).not.toThrow();
    const newRootConfig = readFile('jest.config.ts');
    expect(newRootConfig).toContain(`getJestProjects`);
    const projectConfig = readFile(newName);
    expect(projectConfig).toEqual(rootConfig);
    rootProjectConfig = readJson('project.json');
    expect(rootProjectConfig.targets.test.options.jestConfig).toEqual(newName);
  });
});
