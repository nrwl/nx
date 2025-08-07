import { names } from '@nx/devkit';
import {
  cleanupProject,
  getPackageManagerCommand,
  getRandomPort,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

let originalEnvPort;

describe('Node Esbuild Applications', () => {
  beforeAll(() => {
    originalEnvPort = process.env.PORT;
    newProject({
      preset: 'ts',
    });
  });

  afterAll(() => {
    process.env.PORT = originalEnvPort;
    cleanupProject();
  });

  it('it should generate an app that cosumes a non-buildable ts library', () => {
    const nodeapp = uniq('nodeapp');
    const lib = uniq('lib');
    const port = getRandomPort();
    process.env.PORT = `${port}`;

    runCLI(
      `generate @nx/node:app apps/${nodeapp} --port=${port} --bundler=esbuild --framework=fastify --no-interactive`
    );

    runCLI(
      `generate @nx/js:lib packages/${lib} --bundler=none --e2eTestRunner=none --unitTestRunner=none`
    );

    updateFile(
      `apps/${nodeapp}/src/main.ts`,
      (content) => `import { ${names(lib).propertyName} } from '@proj/${lib}';
      
      console.log(${names(lib).propertyName}());

      ${content}
      `
    );

    // App is CJS by default so lets update the lib to follow the same pattern
    updateJson(`packages/${lib}/tsconfig.lib.json`, (json) => {
      json.compilerOptions.module = 'commonjs';
      json.compilerOptions.moduleResolution = 'node';
      return json;
    });

    updateJson('tsconfig.base.json', (json) => {
      json.compilerOptions.moduleResolution = 'node';
      json.compilerOptions.module = 'esnext';
      delete json.compilerOptions.customConditions;
      return json;
    });

    const pm = getSelectedPackageManager();
    if (pm === 'pnpm') {
      updateJson(`apps/${nodeapp}/package.json`, (json) => {
        json.dependencies ??= {};
        json.dependencies[`@proj/${lib}`] = 'workspace:*';
        return json;
      });

      const pmc = getPackageManagerCommand({ packageManager: pm });
      runCommand(pmc.install);
    }

    runCLI('sync');

    // check build
    expect(runCLI(`build ${nodeapp}`)).toContain(
      `Successfully ran target build for project @proj/${nodeapp}`
    );
  });
});
