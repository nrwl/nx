import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  killPort,
  newProject,
  promisifiedTreeKill,
  readFile,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Node Applications + webpack', () => {
  let proj: string;
  const selectedPm = getSelectedPackageManager();

  // TODO(nicholas): Look into how this can work with npm instead of forcing pnpm.
  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/node'],
      // npm has resolution for ajv some packages require ajv6 and some require ajv8 and npm resolves it to ajv6 (Error: Cannot find module 'ajv/dist/compile/codegen')
      // - ajv@6 (fork-ts-checker-webpack-plugin, terser-webpack-plugin, webpack)
      // - ajv@8 (babel-loader)
      // Solution is to use pnpm or run fix it via npm ex.(npm dedupe --force)
      packageManager: selectedPm === 'npm' ? 'pnpm' : selectedPm,
    });
  });

  afterAll(() => cleanupProject());

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

  async function runE2eTests(appName: string, port: number = 5000) {
    process.env.PORT = `${port}`;
    const childProcess = await runCommandUntil(`serve ${appName}`, (output) => {
      return output.includes(`http://localhost:${port}`);
    });
    const result = runCLI(`e2e ${appName}-e2e --verbose`);
    expect(result).toContain('Setting up...');
    expect(result).toContain('Tearing down..');
    expect(result).toContain('Successfully ran target e2e');

    await promisifiedTreeKill(childProcess.pid, 'SIGKILL');
    await killPort(port);
    process.env.PORT = '';
  }

  describe('frameworks', () => {
    const testLib1 = uniq('test1');
    const testLib2 = uniq('test2');
    const expressApp = uniq('expressapp');
    const fastifyApp = uniq('fastifyapp');
    const koaApp = uniq('koaapp');
    const nestApp = uniq('nest');

    beforeAll(() => {
      runCLI(`generate @nx/node:lib ${testLib1}`);
      runCLI(`generate @nx/node:lib ${testLib2} --importPath=@acme/test2`);
      runCLI(
        `generate @nx/node:app ${expressApp} --framework=express --port=7000 --no-interactive`
      );
      runCLI(
        `generate @nx/node:app ${fastifyApp} --framework=fastify --port=7001 --no-interactive`
      );
      runCLI(
        `generate @nx/node:app ${koaApp} --framework=koa --port=7002 --no-interactive`
      );
      runCLI(
        `generate @nx/node:app ${nestApp} --framework=nest --port=7003 --bundler=webpack --no-interactive`
      );

      addLibImport(expressApp, testLib1);
      addLibImport(expressApp, testLib2, '@acme/test2');
      addLibImport(fastifyApp, testLib1);
      addLibImport(fastifyApp, testLib2, '@acme/test2');
      addLibImport(koaApp, testLib1);
      addLibImport(koaApp, testLib2, '@acme/test2');

      addLibImport(nestApp, testLib1);
      addLibImport(nestApp, testLib2, '@acme/test2');
    });

    it('should generate an app defaults using webpack or esbuild', async () => {
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
      expect(() => runCLI(`test ${fastifyApp}`)).not.toThrow();

      // https://github.com/nrwl/nx/issues/16601
      const nestMainContent = readFile(`apps/${nestApp}/src/main.ts`);
      updateFile(
        `apps/${nestApp}/src/main.ts`,
        `
      ${nestMainContent}
      // Make sure this is not replaced during build time
      console.log('env: ' + process.env['NODE_ENV']);
      `
      );
      runCLI(`build ${nestApp}`);
      expect(readFile(`dist/apps/${nestApp}/main.js`)).toContain(
        `'env: ' + process.env['NODE_ENV']`
      );
    }, 300_000);

    it('should e2e test express app', async () => {
      await runE2eTests(expressApp, 7000);
    });

    it('should e2e test fastify app', async () => {
      await runE2eTests(fastifyApp, 7001);
    });

    it('should e2e test koa app', async () => {
      await runE2eTests(koaApp, 7002);
    });

    it('should e2e test nest app', async () => {
      await runE2eTests(nestApp, 7003);
    });
  });

  it('should generate a Dockerfile', async () => {
    const expressApp = 'docker-express-app'; // needs to be consistent for the Dockerfile snapshot

    runCLI(
      `generate @nx/node:app ${expressApp} --framework=express --docker --no-interactive`
    );

    checkFilesExist(`apps/${expressApp}/Dockerfile`);
    const dockerFile = readFile(`apps/${expressApp}/Dockerfile`);
    expect(dockerFile).toMatchSnapshot();
  }, 300_000);

  it('should support waitUntilTargets for serve target', async () => {
    const nodeApp1 = uniq('nodeapp1');
    const nodeApp2 = uniq('nodeapp2');

    // Set ports to avoid conflicts with other tests that might run in parallel
    runCLI(
      `generate @nx/node:app ${nodeApp1} --framework=none --no-interactive --port=4444`
    );
    runCLI(
      `generate @nx/node:app ${nodeApp2} --framework=none --no-interactive --port=4445`
    );
    updateJson(join('apps', nodeApp1, 'project.json'), (config) => {
      config.targets.serve.options.waitUntilTargets = [`${nodeApp2}:build`];
      return config;
    });

    runCLI(`serve ${nodeApp1} --watch=false`);

    checkFilesExist(`dist/apps/${nodeApp1}/main.js`);
    checkFilesExist(`dist/apps/${nodeApp2}/main.js`);
  }, 300_000);
});
