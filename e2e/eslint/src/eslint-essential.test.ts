/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * eslint package. It tests the core public API.
 *
 * FAILURE POLICY
 *  - If any test here fails, the package is considered broken.
 *  - Fix the underlying issue immediately, do not merge or release until green.
 *  - Do not update snapshots here without an accompanying, intentional code change.
 *
 * GUIDELINES
 *  - Keep tests small and focused on fundamental behavior.
 *  - No edge-cases we should only test the critical paths.
 *  - CI pipelines must block on failures in this file (no skips or timeouts).
 *
 * MAINTENANCE
 *  - Whenever you change core behavior, update this file first to cover the new expectations.
 *  - Add new “essential” tests here only if they test core functionality.
 * ──────────────────────────────────────────────────────────────────────────────
 */
import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('ESLint essential tests', () => {
  let mylib: string;

  let originalEslintUseFlatConfigVal: string | undefined;

  beforeAll(() => {
    // Opt into legacy .eslintrc config format for these tests
    originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    newProject({
      packages: ['@nx/js', '@nx/eslint'],
    });
    mylib = uniq('mylib');
    runCLI(`generate @nx/js:lib ${mylib} --linter=eslint`);
  });

  afterAll(() => {
    cleanupProject();
    process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
  });

  it('should lint the library without errors', () => {
    checkFilesExist(`${mylib}/.eslintrc.json`);

    const result = runCLI(`lint ${mylib}`);
    expect(result).toContain('Successfully ran target lint');
  });

  it('should lint the library with errors', () => {
    updateFile(`${mylib}/src/index.ts`, `console.log("should fail");`);

    const eslintrc = readJson('.eslintrc.json');

    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = 'error';
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));
    const result = runCLI(`lint ${mylib}`, { silenceError: true });
    expect(result).toContain('Unexpected console statement');
  });
});
