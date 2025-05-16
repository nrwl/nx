/**
 * GOLDEN TEST SUITE — CRITICAL HEALTH CHECK
 *
 * This file contains the “essential” (aka golden) tests for the
 * node package. It tests the core public API.
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
  killPorts,
  newProject,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

import { execSync } from 'child_process';

describe('Node essential tests', () => {
  let originalEnvPort;
  beforeAll(() => {
    originalEnvPort = process.env.PORT;
    newProject({
      packages: ['@nx/node', '@nx/esbuild', '@nx/jest', '@nx/eslint'],
    });
  });

  afterAll(() => {
    process.env.PORT = originalEnvPort;
    cleanupProject();
  });

  it('should be able to generate, build, test and lint an application', async () => {
    const nodeapp = uniq('nodeapp');
    const port = getRandomPort();
    process.env.PORT = `${port}`;
    runCLI(
      `generate @nx/node:app apps/${nodeapp} --port=${port} --linter=eslint --unitTestRunner=jest`
    );

    const lintResult = runCLI(`lint ${nodeapp}`);
    const testResult = runCLI(`test ${nodeapp}`);

    expect(lintResult).toContain(
      `Successfully ran target lint for project ${nodeapp}`
    );
    expect(testResult).toContain(
      `Successfully ran target test for project ${nodeapp}`
    );

    updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
    await runCLIAsync(`build ${nodeapp}`);

    checkFilesExist(`dist/apps/${nodeapp}/main.js`);
    const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('Hello World!');
    await killPorts(port);
  }, 300000);
});

function getRandomPort() {
  return Math.floor(1000 + Math.random() * 9000);
}
