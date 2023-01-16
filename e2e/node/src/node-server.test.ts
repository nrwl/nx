import {
  checkFilesDoNotExist,
  cleanupProject,
  killPort,
  newProject,
  promisifiedTreeKill,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nrwl/e2e/utils';

describe('Node Applications + webpack', () => {
  beforeEach(() => newProject());

  afterEach(() => cleanupProject());

  async function runE2eTests(appName: string) {
    process.env.PORT = '5000';
    const childProcess = await runCommandUntil(`serve ${appName}`, (output) => {
      return output.includes('http://localhost:5000');
    });
    const result = runCLI(`e2e ${appName}-e2e`);
    expect(result).toContain('Setting up...');
    expect(result).toContain('Tearing down..');
    expect(result).toContain('Successfully ran target e2e');

    await promisifiedTreeKill(childProcess.pid, 'SIGKILL');
    await killPort(5000);
    process.env.PORT = '';
  }

  it('should generate an app using webpack', async () => {
    const expressApp = uniq('expressapp');
    const fastifyApp = uniq('fastifyapp');
    const koaApp = uniq('koaapp');

    runCLI(
      `generate @nrwl/node:app ${expressApp} --framework=express --no-interactive`
    );
    runCLI(
      `generate @nrwl/node:app ${fastifyApp} --framework=fastify --no-interactive`
    );
    runCLI(
      `generate @nrwl/node:app ${koaApp} --framework=koa --no-interactive`
    );

    // Use esbuild by default
    checkFilesDoNotExist(`apps/${expressApp}/webpack.config.js`);
    checkFilesDoNotExist(`apps/${fastifyApp}/webpack.config.js`);
    checkFilesDoNotExist(`apps/${koaApp}/webpack.config.js`);

    expect(() => runCLI(`lint ${expressApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${fastifyApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${koaApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${expressApp}-e2e`)).not.toThrow();
    expect(() => runCLI(`lint ${fastifyApp}-e2e`)).not.toThrow();
    expect(() => runCLI(`lint ${koaApp}-e2e`)).not.toThrow();

    await runE2eTests(expressApp);
    await runE2eTests(fastifyApp);
    await runE2eTests(koaApp);
  }, 300_000);
});
