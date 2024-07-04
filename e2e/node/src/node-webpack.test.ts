import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  waitUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  promisifiedTreeKill,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';
import { join } from 'path';

describe('Node Applications + webpack', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/node'],
    })
  );

  afterAll(() => cleanupProject());

  it('should generate an app using webpack', async () => {
    const app = uniq('nodeapp');

    // This fails with Crystal enabled because `--optimization` is not a correct flag to pass to `webpack`.
    runCLI(`generate @nx/node:app ${app} --bundler=webpack --no-interactive`, {
      env: { NX_ADD_PLUGINS: 'false' },
    });

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

    await runCLIAsync(`build ${app} --optimization`);
    const optimizedContent = readFile(`dist/apps/${app}/main.js`);
    expect(optimizedContent).toContain('console.log("foo "+"bar")');

    // Test that serve can re-run dependency builds.
    const lib = uniq('nodelib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=esbuild --no-interactive`);

    updateJson(join('apps', app, 'project.json'), (config) => {
      // Since we read from lib from dist, we should re-build it when lib changes.
      config.targets.build.options.buildLibsFromSource = false;
      config.targets.serve.options.runBuildTargetDependencies = true;
      return config;
    });

    updateFile(
      `apps/${app}/src/main.ts`,
      `
      import { ${lib} } from '@proj/${lib}';
      console.log('Hello ' + ${lib}());
    `
    );

    const serveProcess = await runCommandUntil(
      `serve ${app} --watch --runBuildTargetDependencies`,
      (output) => {
        return output.includes(`Hello`);
      },
      {
        env: {
          NX_DAEMON: 'true',
        },
      }
    );

    // Update library source and check that it triggers rebuild.
    const terminalOutputs: string[] = [];
    serveProcess.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      terminalOutputs.push(data);
    });

    updateFile(
      `libs/${lib}/src/index.ts`,
      `export function ${lib}() { return 'should rebuild lib'; }`
    );

    await waitUntil(
      () => {
        return terminalOutputs.some((output) =>
          output.includes(`should rebuild lib`)
        );
      },
      { timeout: 60_000, ms: 200 }
    );

    await promisifiedTreeKill(serveProcess.pid, 'SIGKILL');
  }, 300_000);
});
