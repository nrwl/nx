import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  expectJestTestsToPass,
  cleanupProject,
} from '@nx/e2e/utils';

describe('Jest', () => {
  beforeAll(() => {
    newProject({ name: uniq('proj-jest'), packages: ['@nx/js', '@nx/node'] });
  });

  afterAll(() => cleanupProject());

  it('should support multiple `coverageReporters` when using @nx/jest:jest executor', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:lib libs/${mylib} --unitTestRunner=jest`, {
      env: {
        NX_ADD_PLUGINS: 'false',
      },
    });

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
});
