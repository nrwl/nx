import { names } from '@nx/devkit';
import {
  cleanupProject,
  getPackageManagerCommand,
  getRandomPort,
  newProject,
  runCLI,
  runCommand,
  stripIndents,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

let originalEnvPort;
describe('Node Docker Applications', () => {
  describe.each(['npm', 'yarn', 'pnpm'])(
    '%s',
    (packageManager: 'npm' | 'yarn' | 'pnpm') => {
      beforeEach(() => {
        originalEnvPort = process.env.PORT;
        newProject({
          preset: 'ts',
          packageManager,
        });
      });

      afterEach(() => {
        process.env.PORT = originalEnvPort;
        cleanupProject();
      });

      it(`should generate ${packageManager} compliant dockerfile and use it`, async () => {
        const { nodeapp } = setupTest(packageManager);
        expect(runCLI(`docker:build ${nodeapp} --network=host`)).toContain(
          `Successfully ran target docker:build for project @proj/${nodeapp}`
        );
      });
    }
  );
});

function setupTest(packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun') {
  const nodeapp = uniq('nodeapp');
  const lib = uniq('lib');
  const port = getRandomPort();
  process.env.PORT = `${port}`;

  runCLI(
    `generate @nx/node:app apps/${nodeapp} --port=${port} --bundler=esbuild --framework=fastify --docker=true --no-interactive`
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

  if (packageManager === 'pnpm' || packageManager === 'yarn') {
    updateJson(`apps/${nodeapp}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${lib}`] = 'workspace:*';
      return json;
    });
  } else if (packageManager === 'npm') {
    updateJson(`apps/${nodeapp}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${lib}`] = '*';
      return json;
    });
  }
  const pmc = getPackageManagerCommand({ packageManager });
  runCommand(pmc.install);

  runCLI('sync');

  return { nodeapp };
}
