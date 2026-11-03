import { join } from 'node:path';
import {
  getPackageManagerCommand,
  runCLI,
  runCLIAsync,
  runCommand,
} from './command-utils';
import { uniq, tmpProjPath } from './create-project-utils';
import { readFile, fileExists, updateFile, updateJson } from './file-utils';

type GeneratorsWithDefaultTests =
  | '@nx/js:lib'
  | '@nx/node:lib'
  | '@nx/react:lib'
  | '@nx/react:app'
  | '@nx/next:app'
  | '@nx/angular:app'
  | '@nx/web:app';

/**
 * Runs the pass in generator and then runs test on
 * the generated project to make sure the default tests pass.
 */
export async function expectJestTestsToPass(
  generator: GeneratorsWithDefaultTests | string
) {
  const name = uniq('proj');
  const generatedResults = runCLI(
    `generate ${generator} ${name} --no-interactive`
  );
  expect(generatedResults).toContain(`jest.config.ts`);

  const results = await runCLIAsync(`test ${name}`);
  expect(results.combinedOutput).toContain('Test Suites: 1 passed, 1 total');
}

export function expectTestsPass(v: { stdout: string; stderr: string }) {
  expect(v.stderr).toContain('Ran all test suites');
  expect(v.stderr).not.toContain('fail');
}

// TODO(meeroslav): This is test specific, it should not be in the utils
export function expectNoAngularDevkit() {
  const { list } = getPackageManagerCommand();
  const result = runCommand(`${list} @angular-devkit/core`);
  expect(result).not.toContain('@angular-devkit/core');
}

// TODO(meeroslav): This is test specific, it should not be in the utils
export function expectNoTsJestInJestConfig(appName: string) {
  const candidates = [
    tmpProjPath(join('apps', appName, 'jest.config.js')),
    tmpProjPath(join('apps', appName, 'jest.config.ts')),
    tmpProjPath(join('apps', appName, 'jest.config.cts')),
  ];
  let jestConfig: string;
  for (const c of candidates) {
    if (fileExists(c)) {
      jestConfig = readFile(c);
      break;
    }
  }
  if (!jestConfig) {
    throw new Error(`Could not find jest config for app/lib: ${appName}`);
  }
  expect(jestConfig).not.toContain('ts-jest');
}

/**
 * Adds a `check` target that waits for `serveTarget` to be ready and requests
 * NX_READY_URL. It reaches the server only through the url the signal carried,
 * so it passes only if Nx waited for the signal and passed the url on.
 */
export function addReadyUrlCheck(projectRoot: string, serveTarget: string) {
  updateJson(`${projectRoot}/project.json`, (config) => {
    config.targets ??= {};
    config.targets.check = {
      command:
        "node -e \"const url = process.env.NX_READY_URL; console.log('URL=' + url); require('http').get(url, (r) => { console.log('STATUS=' + r.statusCode); process.exit(r.statusCode < 400 ? 0 : 1); })\"",
      dependsOn: [{ target: serveTarget, waitFor: 'ready' }],
    };
    return config;
  });
}

/**
 * Asserts that the check from {@link addReadyUrlCheck} reached the server on
 * `port`. The server binds whichever loopback address the platform resolves
 * `localhost` to.
 */
export function expectServedOn(output: string, port: number) {
  expect(output).toMatch(
    new RegExp(`URL=http://(localhost|127\\.0\\.0\\.1|\\[::1\\]):${port}/`)
  );
  expect(output).toMatch(/STATUS=[23]\d\d/);
}

export function expectCodeIsFormatted() {
  expect(() => runCLI(`format:check`)).not.toThrow();
}

export function setCypressWebServerTimeout(
  cypressConfigPath: string,
  timeout = 60_000
) {
  const cypressConfig = readFile(cypressConfigPath);
  updateFile(
    cypressConfigPath,
    cypressConfig.replace(
      `nxE2EPreset(__filename, {`,
      `nxE2EPreset(__filename, {
        webServerConfig: {
          timeout: ${timeout},
        },`
    )
  );
}
