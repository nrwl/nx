import {
  checkFilesDoNotExist,
  checkFilesExist,
  createFile,
  isNotWindows,
  killPorts,
  newProject,
  readFile,
  removeFile,
  cleanupProject,
  runCLI,
  runCLIAsync,
  runCypressTests,
  uniq,
  updateFile,
  updateProjectConfig,
  expectJestTestsToPass,
} from '@nrwl/e2e/utils';

describe('Web Components Applications', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

  it('should be able to generate a web app', async () => {
    const appName = uniq('app');
    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');

    runCLI(`build ${appName} --outputHashing none --compiler babel`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.esm.js`,
      `dist/apps/${appName}/polyfills.esm.js`,
      `dist/apps/${appName}/main.esm.js`,
      `dist/apps/${appName}/styles.css`
    );

    expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
      `<link rel="stylesheet" href="styles.css">`
    );

    const testResults = await runCLIAsync(`test ${appName}`);

    expect(testResults.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );

    const lintE2eResults = runCLI(`lint ${appName}-e2e`);

    expect(lintE2eResults).toContain('All files pass linting.');

    if (isNotWindows() && runCypressTests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }
  }, 500000);

  it('should be able to generate a web app with standaloneConfig', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nrwl/web:app ${appName} --no-interactive --standalone-config`
    );

    checkFilesExist(`apps/${appName}/project.json`);

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');
  }, 120000);

  it('should remove previous output before building', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive --compiler swc`);
    runCLI(
      `generate @nrwl/react:lib ${libName} --buildable --no-interactive --compiler swc`
    );

    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/libs/${libName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName} --outputHashing none`);
    runCLI(`build ${libName}`);
    checkFilesDoNotExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/libs/${libName}/_should_remove.txt`
    );
    checkFilesExist(`dist/apps/_should_not_remove.txt`);

    // Asset that React runtime is imported
    expect(readFile(`dist/libs/${libName}/index.esm.js`)).toMatch(
      /react\/jsx-runtime/
    );

    // `delete-output-path`
    createFile(`dist/apps/${appName}/_should_keep.txt`);
    runCLI(`build ${appName} --delete-output-path=false --outputHashing none`);
    checkFilesExist(`dist/apps/${appName}/_should_keep.txt`);

    createFile(`dist/libs/${libName}/_should_keep.txt`);
    runCLI(`build ${libName} --delete-output-path=false --outputHashing none`);
    checkFilesExist(`dist/libs/${libName}/_should_keep.txt`);
  }, 120000);

  it('should do another build if differential loading is needed', async () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    updateFile(`apps/${appName}/browserslist`, `IE 9-11`);

    runCLI(`build ${appName} --outputHashing=none`);

    checkFilesExist(
      `dist/apps/${appName}/main.esm.js`,
      `dist/apps/${appName}/main.es5.js`
    );
  }, 120000);

  it('should emit decorator metadata when it is enabled in tsconfig', async () => {
    const appName = uniq('app');
    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

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
    runCLI(`build ${appName} --outputHashing none`);

    expect(readFile(`dist/apps/${appName}/main.esm.js`)).toMatch(
      /Reflect\.metadata/
    );

    // Turn off decorator metadata
    updateFile(`apps/${appName}/tsconfig.app.json`, (content) => {
      const json = JSON.parse(content);
      json.compilerOptions.emitDecoratorMetadata = false;
      return JSON.stringify(json);
    });

    runCLI(`build ${appName} --outputHashing none`);

    expect(readFile(`dist/apps/${appName}/main.esm.js`)).not.toMatch(
      /Reflect\.metadata/
    );
  }, 120000);

  it('should support workspaces w/o workspace config file', async () => {
    removeFile('workspace.json');
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/web:app ${myapp} --directory=myDir`);

    runCLI(`build my-dir-${myapp}`);
    expect(() =>
      checkFilesDoNotExist('workspace.json', 'angular.json')
    ).not.toThrow();
  }, 1000000);

  it('should run default jest tests', async () => {
    await expectJestTestsToPass('@nrwl/web:app');
  }, 100000);
});

describe('CLI - Environment Variables', () => {
  it('should automatically load workspace and per-project environment variables', () => {
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
      const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API, process.env.NX_WS_BASE, process.env.NX_WS_ENV_LOCAL, process.env.NX_WS_LOCAL_ENV, process.env.NX_APP_BASE, process.env.NX_APP_ENV_LOCAL, process.env.NX_APP_LOCAL_ENV, process.env.NX_SHARED_ENV];
      const nodeEnv = process.env.NODE_ENV;
      const nxBuild = process.env.NX_BUILD;
      const nxApi = process.env.NX_API;
      const nxWsBase = process.env.NX_WS_BASE;
      const nxWsEnvLocal = process.env.NX_WS_ENV_LOCAL;
      const nxWsLocalEnv = process.env.NX_WS_LOCAL_ENV;
      const nxAppBase = process.env.NX_APP_BASE;
      const nxAppEnvLocal = process.env.NX_APP_ENV_LOCAL;
      const nxAppLocalEnv = process.env.NX_APP_LOCAL_ENV;
      const nxSharedEnv = process.env.NX_SHARED_ENV;
      `;

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

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
    const newCode2 = `const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API, process.env.NX_WS_BASE, process.env.NX_WS_ENV_LOCAL, process.env.NX_WS_LOCAL_ENV, process.env.NX_APP_BASE, process.env.NX_APP_ENV_LOCAL, process.env.NX_APP_LOCAL_ENV, process.env.NX_SHARED_ENV];`;

    runCLI(`generate @nrwl/web:app ${appName2} --no-interactive`);

    const content2 = readFile(main2);

    updateFile(main2, `${newCode2}\n${content2}`);

    runCLI(`run-many --target build --all --no-optimization`, {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NX_BUILD: '52',
        NX_API: 'QA',
      },
    });
    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'const envVars = ["test", "52", "QA", "ws-base", "ws-env-local", "ws-local-env", "app-base", "app-env-local", "app-local-env", "shared-in-app-env-local"];'
    );
    expect(readFile(`dist/apps/${appName2}/main.js`)).toContain(
      'const envVars = ["test", "52", "QA", "ws-base", "ws-env-local", "ws-local-env", "app2-base", "app2-env-local", "app2-local-env", "shared2-in-app-env-local"];'
    );
  });
});

describe('Build Options', () => {
  it('should inject/bundle external scripts and styles', () => {
    newProject();

    const appName = uniq('app');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    const srcPath = `apps/${appName}/src`;
    const fooCss = `${srcPath}/foo.css`;
    const barCss = `${srcPath}/bar.css`;
    const fooJs = `${srcPath}/foo.js`;
    const barJs = `${srcPath}/bar.js`;
    const fooCssContent = `/* ${uniq('foo')} */`;
    const barCssContent = `/* ${uniq('bar')} */`;
    const fooJsContent = `/* ${uniq('foo')} */`;
    const barJsContent = `/* ${uniq('bar')} */`;

    createFile(fooCss);
    createFile(barCss);
    createFile(fooJs);
    createFile(barJs);

    // createFile could not create a file with content
    updateFile(fooCss, fooCssContent);
    updateFile(barCss, barCssContent);
    updateFile(fooJs, fooJsContent);
    updateFile(barJs, barJsContent);

    const barScriptsBundleName = 'bar-scripts';
    const barStylesBundleName = 'bar-styles';

    updateProjectConfig(appName, (config) => {
      const buildOptions = config.targets.build.options;

      buildOptions.scripts = [
        {
          input: fooJs,
          inject: true,
        },
        {
          input: barJs,
          inject: false,
          bundleName: barScriptsBundleName,
        },
      ];

      buildOptions.styles = [
        {
          input: fooCss,
          inject: true,
        },
        {
          input: barCss,
          inject: false,
          bundleName: barStylesBundleName,
        },
      ];
      return config;
    });

    runCLI(`build ${appName} --outputHashing none --optimization false`);

    const distPath = `dist/apps/${appName}`;
    const scripts = readFile(`${distPath}/scripts.js`);
    const styles = readFile(`${distPath}/styles.css`);
    const barScripts = readFile(`${distPath}/${barScriptsBundleName}.js`);
    const barStyles = readFile(`${distPath}/${barStylesBundleName}.css`);

    expect(scripts).toContain(fooJsContent);
    expect(scripts).not.toContain(barJsContent);
    expect(barScripts).toContain(barJsContent);

    expect(styles).toContain(fooCssContent);
    expect(styles).not.toContain(barCssContent);
    expect(barStyles).toContain(barCssContent);
  });
});

describe('index.html interpolation', () => {
  test('should interpolate environment variables', () => {
    const appName = uniq('app');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    const srcPath = `apps/${appName}/src`;
    const indexPath = `${srcPath}/index.html`;
    const indexContent = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>BestReactApp</title>
        <base href="/" />

        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
      </head>
      <body>
        <div id="root"></div>
        <div>Nx Variable: %NX_VARIABLE%</div>
        <div>Some other variable: %SOME_OTHER_VARIABLE%</div>
        <div>Deploy Url: %DEPLOY_URL%</div>
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

    updateProjectConfig(appName, (config) => {
      const buildOptions = config.targets.build.options;
      buildOptions.deployUrl = 'baz';
      return config;
    });

    runCLI(`build ${appName}`);

    const distPath = `dist/apps/${appName}`;
    const resultIndexContents = readFile(`${distPath}/index.html`);

    expect(resultIndexContents).toMatch(/<div>Nx Variable: foo<\/div>/);
    expect(resultIndexContents).toMatch(/<div>Nx Variable: foo<\/div>/);
    expect(resultIndexContents).toMatch(/ <div>Nx Variable: foo<\/div>/);
  });
});
