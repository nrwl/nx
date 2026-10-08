import {
  checkFilesExist,
  cleanupProject,
  newProject,
  promisifiedTreeKill,
  readFile,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  waitUntil,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';

describe('Node Applications + webpack', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/node', '@nx/webpack', '@nx/esbuild'],
    })
  );

  afterAll(() => cleanupProject());

  it('should build an app and rebuild it when a dependency changes', async () => {
    const app = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app apps/${app} --bundler=webpack --no-interactive --linter=eslint --unitTestRunner=jest`
    );

    checkFilesExist(`apps/${app}/webpack.config.js`);

    updateFile(
      `apps/${app}/src/main.ts`,
      `
      function foo(x: string) {
        return "foo " + x;
      };
      console.log(foo("bar"));
    `
    );
    await runCLIAsync(`build ${app}`);

    checkFilesExist(`dist/apps/${app}/main.js`);
    // no optimization by default
    const content = readFile(`dist/apps/${app}/main.js`);
    expect(content).toContain('console.log(foo("bar"))');

    const result = execSync(`node dist/apps/${app}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toMatch(/foo bar/);

    const lib = uniq('nodelib');
    runCLI(
      `generate @nx/js:lib libs/${lib} --bundler=esbuild --no-interactive`
    );

    updateFile(
      `apps/${app}/src/main.ts`,
      `
      import { ${lib} } from '@proj/${lib}';
      console.log('Hello ' + ${lib}());
    `
    );

    const serveProcess = await runCommandUntil(
      `serve ${app} --watch --runBuildTargetDependencies`,
      (output) => output.includes(`Hello`),
      { env: { NX_DAEMON: 'true' } }
    );

    const terminalOutputs: string[] = [];
    serveProcess.stdout.on('data', (chunk) => {
      terminalOutputs.push(chunk.toString());
    });

    updateFile(
      `libs/${lib}/src/index.ts`,
      `export function ${lib}() { return 'should rebuild lib'; }`
    );

    await waitUntil(
      () =>
        terminalOutputs.some((output) => output.includes(`should rebuild lib`)),
      { timeout: 60_000, ms: 200 }
    );

    await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
  }, 300_000);
});
