import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  isNotWindows,
  killPorts,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';
import { copyFileSync } from 'fs';

describe('Web Components Applications', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  it('should be able to generate a web app', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`
    );

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('Successfully ran target lint');

    const testResults = await runCLIAsync(`test ${appName}`);

    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
    const lintE2eResults = runCLI(`lint ${appName}-e2e`);

    expect(lintE2eResults).toContain('Successfully ran target lint');

    if (isNotWindows() && runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('All specs passed!');
      await killPorts();
    }

    copyFileSync(
      join(__dirname, 'test-fixtures/inlined.png'),
      join(tmpProjPath(), `apps/${appName}/src/app/inlined.png`)
    );
    copyFileSync(
      join(__dirname, 'test-fixtures/emitted.png'),
      join(tmpProjPath(), `apps/${appName}/src/app/emitted.png`)
    );
    updateFile(
      `apps/${appName}/src/app/app.element.ts`,
      `
      // @ts-ignore
      import inlined from './inlined.png';
      // @ts-ignore
      import emitted from './emitted.png';
      export class AppElement extends HTMLElement {
        public static observedAttributes = [];
        connectedCallback() {
          this.innerHTML = \`
            <img src='\${inlined} '/>
            <img src='\${emitted} '/>
          \`;
        }
      }
      customElements.define('app-root', AppElement);
    `
    );
    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/emitted.png`,
      `dist/apps/${appName}/main.js`,
      `dist/apps/${appName}/styles.css`
    );
    checkFilesDoNotExist(`dist/apps/${appName}/inlined.png`);

    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'data:image/png;base64'
    );
    // Should not be a JS module but kept as a PNG
    expect(readFile(`dist/apps/${appName}/emitted.png`)).not.toContain(
      'export default'
    );

    expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
      '<link rel="stylesheet" href="styles.css">'
    );
  }, 500000);

  it('should emit decorator metadata when --compiler=babel and it is enabled in tsconfig', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --compiler=babel --no-interactive`
    );

    updateFile(`apps/${appName}/src/app/app.element.ts`, (content) => {
      const newContent = `${content}
        function enumerable(value: boolean) {
          return function (
            target: any,
            propertyKey: string,
            descriptor: PropertyDescriptor
          ) {
            descriptor.enumerable = value;
          };
        }
        function sealed(target: any) {
          return target;
        }

        @sealed
        class Foo {
          @enumerable(false) bar() {}
        }
      `;
      return newContent;
    });

    updateFile(`apps/${appName}/src/app/app.element.ts`, (content) => {
      const newContent = `${content}
        // bust babel and nx cache
      `;
      return newContent;
    });
    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);

    expect(readFile(`dist/apps/${appName}/main.js`)).toMatch(
      /Reflect\.metadata/
    );

    // Turn off decorator metadata
    updateFile(`apps/${appName}/tsconfig.app.json`, (content) => {
      const json = JSON.parse(content);
      json.compilerOptions.emitDecoratorMetadata = false;
      return JSON.stringify(json);
    });

    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);

    expect(readFile(`dist/apps/${appName}/main.js`)).not.toMatch(
      /Reflect\.metadata/
    );
  }, 120000);

  it('should emit decorator metadata when using --compiler=swc', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --compiler=swc --no-interactive`
    );

    updateFile(`apps/${appName}/src/app/app.element.ts`, (content) => {
      const newContent = `${content}
        function enumerable(value: boolean) {
          return function (
            target: any,
            propertyKey: string,
            descriptor: PropertyDescriptor
          ) {
            descriptor.enumerable = value;
          };
        }
        function sealed(target: any) {
          return target;
        }

        @sealed
        class Foo {
          @enumerable(false) bar() {}
        }
      `;
      return newContent;
    });

    updateFile(`apps/${appName}/src/app/app.element.ts`, (content) => {
      const newContent = `${content}
        // bust babel and nx cache
      `;
      return newContent;
    });
    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);

    expect(readFile(`dist/apps/${appName}/main.js`)).toMatch(
      /Foo=.*?_decorate/
    );
  }, 120000);

  it('should support generating applications with the new name and root format', () => {
    const appName = uniq('app1');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("apps/") and
    // using the project name as the directory when no directory is provided
    checkFilesExist(`${appName}/src/main.ts`);
    // check build works
    expect(runCLI(`build ${appName}`)).toContain(
      `Successfully ran target build for project ${appName}`
    );
    // check tests pass
    const appTestResult = runCLI(`test ${appName}`);
    expect(appTestResult).toContain(
      `Successfully ran target test for project ${appName}`
    );
  }, 500_000);
});

describe('CLI - Environment Variables', () => {
  it('should automatically load workspace and per-project environment variables', async () => {
    newProject();

    const appName = uniq('app');
    //test if the Nx CLI loads root .env vars
    updateFile(
      `.env`,
      'NX_WS_BASE=ws-base\nNX_SHARED_ENV=shared-in-workspace-base'
    );
    updateFile(
      `.env.local`,
      'NX_WS_ENV_LOCAL=ws-env-local\nNX_SHARED_ENV=shared-in-workspace-env-local'
    );
    updateFile(
      `.local.env`,
      'NX_WS_LOCAL_ENV=ws-local-env\nNX_SHARED_ENV=shared-in-workspace-local-env'
    );
    updateFile(
      `apps/${appName}/.env`,
      'NX_APP_BASE=app-base\nNX_SHARED_ENV=shared-in-app-base'
    );
    updateFile(
      `apps/${appName}/.env.local`,
      'NX_APP_ENV_LOCAL=app-env-local\nNX_SHARED_ENV=shared-in-app-env-local'
    );
    updateFile(
      `apps/${appName}/.local.env`,
      'NX_APP_LOCAL_ENV=app-local-env\nNX_SHARED_ENV=shared-in-app-local-env'
    );
    const main = `apps/${appName}/src/main.ts`;
    const newCode = `
      const envVars = [process.env.NODE_ENV, process.env.NX_WS_BASE, process.env.NX_WS_ENV_LOCAL, process.env.NX_WS_LOCAL_ENV, process.env.NX_APP_BASE, process.env.NX_APP_ENV_LOCAL, process.env.NX_APP_LOCAL_ENV, process.env.NX_SHARED_ENV];
      const nodeEnv = process.env.NODE_ENV;
      const nxWsBase = process.env.NX_WS_BASE;
      const nxWsEnvLocal = process.env.NX_WS_ENV_LOCAL;
      const nxWsLocalEnv = process.env.NX_WS_LOCAL_ENV;
      const nxAppBase = process.env.NX_APP_BASE;
      const nxAppEnvLocal = process.env.NX_APP_ENV_LOCAL;
      const nxAppLocalEnv = process.env.NX_APP_LOCAL_ENV;
      const nxSharedEnv = process.env.NX_SHARED_ENV;
      `;

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive --compiler=babel`
    );

    const content = readFile(main);

    updateFile(main, `${newCode}\n${content}`);

    const appName2 = uniq('app');

    updateFile(
      `apps/${appName2}/.env`,
      'NX_APP_BASE=app2-base\nNX_SHARED_ENV=shared2-in-app-base'
    );
    updateFile(
      `apps/${appName2}/.env.local`,
      'NX_APP_ENV_LOCAL=app2-env-local\nNX_SHARED_ENV=shared2-in-app-env-local'
    );
    updateFile(
      `apps/${appName2}/.local.env`,
      'NX_APP_LOCAL_ENV=app2-local-env\nNX_SHARED_ENV=shared2-in-app-local-env'
    );
    const main2 = `apps/${appName2}/src/main.ts`;
    const newCode2 = `const envVars = [process.env.NODE_ENV, process.env.NX_WS_BASE, process.env.NX_WS_ENV_LOCAL, process.env.NX_WS_LOCAL_ENV, process.env.NX_APP_BASE, process.env.NX_APP_ENV_LOCAL, process.env.NX_APP_LOCAL_ENV, process.env.NX_SHARED_ENV];`;

    runCLI(
      `generate @nx/web:app ${appName2} --bundler=webpack --no-interactive --compiler=babel`
    );

    const content2 = readFile(main2);

    updateFile(main2, `${newCode2}\n${content2}`);

    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    setPluginOption(`apps/${appName}/webpack.config.js`, 'optimization', false);
    setPluginOption(
      `apps/${appName2}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    setPluginOption(
      `apps/${appName2}/webpack.config.js`,
      'optimization',
      false
    );
    runCLI(`run-many --target build --node-env=test`);
    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'const envVars = ["test", "ws-base", "ws-env-local", "ws-local-env", "app-base", "app-env-local", "app-local-env", "shared-in-app-env-local"];'
    );
    expect(readFile(`dist/apps/${appName2}/main.js`)).toContain(
      'const envVars = ["test", "ws-base", "ws-env-local", "ws-local-env", "app2-base", "app2-env-local", "app2-local-env", "shared2-in-app-env-local"];'
    );
  });
});

describe('index.html interpolation', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  test('should interpolate environment variables', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`
    );

    const srcPath = `apps/${appName}/src`;
    const indexPath = `${srcPath}/index.html`;
    const indexContent = `<!DOCTYPE html>
    <html lang='en'>
      <head>
        <meta charset='utf-8' />
        <title>BestReactApp</title>
        <base href='/' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' type='image/x-icon' href='favicon.ico' />
      </head>
      <body>
        <div id='root'></div>
        <div>Nx Variable: %NX_VARIABLE%</div>
        <div>Some other variable: %SOME_OTHER_VARIABLE%</div>
      </body>
    </html>
`;
    const envFilePath = `apps/${appName}/.env`;
    const envFileContents = `
      NX_VARIABLE=foo
      SOME_OTHER_VARIABLE=bar
    }`;

    createFile(envFilePath);

    // createFile could not create a file with content
    updateFile(envFilePath, envFileContents);
    updateFile(indexPath, indexContent);

    runCLI(`build ${appName}`);

    const distPath = `dist/apps/${appName}`;
    const resultIndexContents = readFile(`${distPath}/index.html`);

    expect(resultIndexContents).toMatch(/<div>Nx Variable: foo<\/div>/);
  });
});

function setPluginOption(
  webpackConfigPath: string,
  option: string,
  value: string | boolean
): void {
  updateFile(webpackConfigPath, (content) => {
    return content.replace(
      new RegExp(`${option}: .+`),
      `${option}: ${typeof value === 'string' ? `'${value}'` : value},`
    );
  });
}
