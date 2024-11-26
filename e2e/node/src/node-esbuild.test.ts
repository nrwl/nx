import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  newProject,
  promisifiedTreeKill,
  readFile,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Node Applications + esbuild', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/node'],
    })
  );

  afterAll(() => cleanupProject());

  it('should generate an app using esbuild', async () => {
    const app = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app apps/${app} --bundler=esbuild --no-interactive`
    );

    checkFilesDoNotExist(`apps/${app}/webpack.config.js`);

    updateFile(`apps/${app}/src/main.ts`, `console.log('Hello World!');`);

    const p = await runCommandUntil(`serve ${app} --watch=false`, (output) => {
      process.stdout.write(output);
      return output.includes(`Hello World!`);
    });
    checkFilesExist(`dist/apps/${app}/main.js`);

    // Check that updating the file won't trigger a rebuild since --watch=false.
    updateFile(`apps/${app}/src/main.ts`, `console.log('Bye1');`);
    await new Promise((res) => setTimeout(res, 2000));

    expect(readFile(`dist/apps/${app}/apps/${app}/src/main.js`)).not.toContain(
      `Bye!`
    );

    await promisifiedTreeKill(p.pid, 'SIGKILL');
  }, 300_000);
});
