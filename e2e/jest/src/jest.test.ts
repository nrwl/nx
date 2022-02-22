import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Jest', () => {
  beforeEach(() => newProject());

  it('should be able test projects using jest', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${mylib} --unit-test-runner jest`);

    const libResult = await runCLIAsync(`test ${mylib}`);
    expect(libResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 500000);

  it('should merge with jest config globals', async () => {
    const testGlobal = `'My Test Global'`;
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${mylib} --unit-test-runner jest`);

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
      `libs/${mylib}/jest.config.js`,
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
            globals: { testGlobal: ${testGlobal} }
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
