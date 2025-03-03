import { names } from '@nx/devkit';
import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

let originalEnvPort;

describe('Node Applications', () => {
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
      `generate @nx/node:app apps/${nodeapp} --port=${port} --bundler=esbuild --linter=none --e2eTestRunner=none --unitTestRunner=none`
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

function getRandomPort() {
  return Math.floor(1000 + Math.random() * 7000);
}
