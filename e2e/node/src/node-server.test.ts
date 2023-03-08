import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  killPort,
  newProject,
  promisifiedTreeKill,
  readFile,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Node Applications + webpack', () => {
  let proj: string;
  beforeEach(() => {
    proj = newProject();
  });

  afterEach(() => cleanupProject());

  function addLibImport(appName: string, libName: string, importPath?: string) {
    const content = readFile(`apps/${appName}/src/main.ts`);
    if (importPath) {
      updateFile(
        `apps/${appName}/src/main.ts`,
        `
      import { ${libName} } from '${importPath}';
      ${content}
      console.log(${libName}());
      `
      );
    } else {
      updateFile(
        `apps/${appName}/src/main.ts`,
        `
      import { ${libName} } from '@${proj}/${libName}';
      ${content}
      console.log(${libName}());
      `
      );
    }
  }

  async function runE2eTests(appName: string) {
    process.env.PORT = '5000';
    const childProcess = await runCommandUntil(`serve ${appName}`, (output) => {
      return output.includes('http://localhost:5000');
    });
    const result = runCLI(`e2e ${appName}-e2e --verbose`);
    expect(result).toContain('Setting up...');
    expect(result).toContain('Tearing down..');
    expect(result).toContain('Successfully ran target e2e');

    await promisifiedTreeKill(childProcess.pid, 'SIGKILL');
    await killPort(5000);
    process.env.PORT = '';
  }

  it('should generate an app using webpack', async () => {
    const testLib1 = uniq('test1');
    const testLib2 = uniq('test2');
    const expressApp = uniq('expressapp');
    const fastifyApp = uniq('fastifyapp');
    const koaApp = uniq('koaapp');
    const nestApp = uniq('koaapp');

    runCLI(`generate @nrwl/node:lib ${testLib1}`);
    runCLI(`generate @nrwl/node:lib ${testLib2} --importPath=@acme/test2`);
    runCLI(
      `generate @nrwl/node:app ${expressApp} --framework=express --no-interactive`
    );
    runCLI(
      `generate @nrwl/node:app ${fastifyApp} --framework=fastify --no-interactive`
    );
    runCLI(
      `generate @nrwl/node:app ${koaApp} --framework=koa --no-interactive`
    );
    runCLI(
      `generate @nrwl/node:app ${nestApp} --framework=nest --bundler=webpack --no-interactive`
    );

    // Use esbuild by default
    checkFilesDoNotExist(`apps/${expressApp}/webpack.config.js`);
    checkFilesDoNotExist(`apps/${fastifyApp}/webpack.config.js`);
    checkFilesDoNotExist(`apps/${koaApp}/webpack.config.js`);

    // Uses only webpack
    checkFilesExist(`apps/${nestApp}/webpack.config.js`);

    expect(() => runCLI(`lint ${expressApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${fastifyApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${koaApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${nestApp}`)).not.toThrow();

    expect(() => runCLI(`lint ${expressApp}-e2e`)).not.toThrow();
    expect(() => runCLI(`lint ${fastifyApp}-e2e`)).not.toThrow();
    expect(() => runCLI(`lint ${koaApp}-e2e`)).not.toThrow();
    expect(() => runCLI(`lint ${nestApp}-e2e`)).not.toThrow();

    // Only Fastify generates with unit tests since it supports them without additional libraries.
    expect(() => runCLI(`lint ${fastifyApp}`)).not.toThrow();

    addLibImport(expressApp, testLib1);
    addLibImport(expressApp, testLib2, '@acme/test2');
    addLibImport(fastifyApp, testLib1);
    addLibImport(fastifyApp, testLib2, '@acme/test2');
    addLibImport(koaApp, testLib1);
    addLibImport(koaApp, testLib2, '@acme/test2');

    addLibImport(nestApp, testLib1);
    addLibImport(nestApp, testLib2, '@acme/test2');

    await runE2eTests(expressApp);
    await runE2eTests(fastifyApp);
    await runE2eTests(koaApp);
    await runE2eTests(nestApp);
  }, 300_000);

  it('should generate a Dockerfile', async () => {
    const expressApp = uniq('expressapp');

    runCLI(
      `generate @nrwl/node:app  ${expressApp} --framework=express --docker --no-interactive`
    );

    checkFilesExist(`apps/${expressApp}/Dockerfile`);
  }, 300_000);
});
