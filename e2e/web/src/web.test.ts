import {
  checkFilesDoNotExist,
  checkFilesExist,
  createFile,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Web Components Applications', () => {
  it('should be able to generate a web app', async () => {
    newProject();
    const appName = uniq('app');
    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('All files pass linting.');

    runCLI(`build ${appName}`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/polyfills.js`,
      `dist/apps/${appName}/main.js`,
      `dist/apps/${appName}/styles.js`
    );
    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'class AppElement'
    );
    runCLI(`build ${appName} --prod --output-hashing none`);
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.js`,
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

    const e2eResults = runCLI(`e2e ${appName}-e2e`);
    expect(e2eResults).toContain('All specs passed!');
  }, 120000);

  it('should remove previous output before building', async () => {
    newProject();
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);
    runCLI(`generate @nrwl/react:lib ${libName} --buildable --no-interactive`);

    createFile(`dist/apps/${appName}/_should_remove.txt`);
    createFile(`dist/libs/${libName}/_should_remove.txt`);
    createFile(`dist/apps/_should_not_remove.txt`);
    checkFilesExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/apps/_should_not_remove.txt`
    );
    runCLI(`build ${appName}`);
    runCLI(`build ${libName}`);
    checkFilesDoNotExist(
      `dist/apps/${appName}/_should_remove.txt`,
      `dist/libs/${libName}/_should_remove.txt`
    );
    checkFilesExist(`dist/apps/_should_not_remove.txt`);

    // `delete-output-path`
    createFile(`dist/apps/${appName}/_should_keep.txt`);
    runCLI(`build ${appName} --delete-output-path=false`);
    checkFilesExist(`dist/apps/${appName}/_should_keep.txt`);

    createFile(`dist/libs/${libName}/_should_keep.txt`);
    runCLI(`build ${libName} --delete-output-path=false`);
    checkFilesExist(`dist/libs/${libName}/_should_keep.txt`);
  }, 120000);

  it('should do another build if differential loading is needed', async () => {
    newProject();
    const appName = uniq('app');

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    updateFile(`apps/${appName}/browserslist`, `IE 9-11`);

    const output = runCLI(`build ${appName} --prod --outputHashing=none`);
    checkFilesExist(
      `dist/apps/${appName}/main.esm.js`,
      `dist/apps/${appName}/main.es5.js`
    );

    // Do not run type checking for legacy build
    expect(
      output.match(/Starting type checking service.../g) || []
    ).toHaveLength(1);
  }, 120000);

  it('should emit decorator metadata when it is enabled in tsconfig', async () => {
    newProject();
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

    runCLI(`build ${appName}`);

    expect(readFile(`dist/apps/${appName}/main.js`)).not.toMatch(
      /Reflect\.metadata/
    );
  }, 120000);
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
      `.local.env`,
      'NX_WS_LOCAL=ws-local\nNX_SHARED_ENV=shared-in-workspace-local'
    );
    updateFile(
      `apps/${appName}/.env`,
      'NX_APP_BASE=app-base\nNX_SHARED_ENV=shared-in-app-base'
    );
    updateFile(
      `apps/${appName}/.local.env`,
      'NX_APP_LOCAL=app-local\nNX_SHARED_ENV=shared-in-app-local'
    );
    const main = `apps/${appName}/src/main.ts`;
    const newCode = `const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API, process.env.NX_WS_BASE, process.env.NX_WS_LOCAL, process.env.NX_APP_BASE, process.env.NX_APP_LOCAL, process.env.NX_SHARED_ENV];`;

    runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

    const content = readFile(main);

    updateFile(main, `${newCode}\n${content}`);

    const appName2 = uniq('app');

    updateFile(
      `apps/${appName2}/.env`,
      'NX_APP_BASE=app2-base\nNX_SHARED_ENV=shared2-in-app-base'
    );
    updateFile(
      `apps/${appName2}/.local.env`,
      'NX_APP_LOCAL=app2-local\nNX_SHARED_ENV=shared2-in-app-local'
    );
    const main2 = `apps/${appName2}/src/main.ts`;
    const newCode2 = `const envVars = [process.env.NODE_ENV, process.env.NX_BUILD, process.env.NX_API, process.env.NX_WS_BASE, process.env.NX_WS_LOCAL, process.env.NX_APP_BASE, process.env.NX_APP_LOCAL, process.env.NX_SHARED_ENV];`;

    runCLI(`generate @nrwl/web:app ${appName2} --no-interactive`);

    const content2 = readFile(main2);

    updateFile(main2, `${newCode2}\n${content2}`);

    runCLI(`run-many --target=build --all`, {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NX_BUILD: '52',
        NX_API: 'QA',
      },
    });
    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'const envVars = ["test", "52", "QA", "ws-base", "ws-local", "app-base", "app-local", "shared-in-app-local"];'
    );
    expect(readFile(`dist/apps/${appName2}/main.js`)).toContain(
      'const envVars = ["test", "52", "QA", "ws-base", "ws-local", "app2-base", "app2-local", "shared2-in-app-local"];'
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

    const workspacePath = `workspace.json`;
    const workspaceConfig = readJson(workspacePath);
    const buildOptions =
      workspaceConfig.projects[appName].targets.build.options;

    const barScriptsBundleName = 'bar-scripts';
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

    const barStylesBundleName = 'bar-styles';
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

    updateFile(workspacePath, JSON.stringify(workspaceConfig));

    runCLI(`build ${appName}`);

    const distPath = `dist/apps/${appName}`;
    const scripts = readFile(`${distPath}/scripts.js`);
    const styles = readFile(`${distPath}/styles.js`);
    const barScripts = readFile(`${distPath}/${barScriptsBundleName}.js`);
    const barStyles = readFile(`${distPath}/${barStylesBundleName}.js`);

    expect(scripts).toContain(fooJsContent);
    expect(scripts).not.toContain(barJsContent);
    expect(barScripts).toContain(barJsContent);

    expect(styles).toContain(fooCssContent);
    expect(styles).not.toContain(barCssContent);
    expect(barStyles).toContain(barCssContent);
  });
});
