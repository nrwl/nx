import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  readFile,
  rmDist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Web Components Applications (legacy)', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

  it('should remove previous output before building', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive --compiler swc`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );
    runCLI(
      `generate @nx/react:lib ${libName} --bundler=rollup --no-interactive --compiler swc --unitTestRunner=jest`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
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

  it('should support custom webpackConfig option', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

    updateJson(join('apps', appName, 'project.json'), (config) => {
      config.targets.build.options.webpackConfig = `apps/${appName}/webpack.config.js`;
      return config;
    });

    // Return sync function
    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const { composePlugins, withNx, withWeb } = require('@nx/webpack');
      module.exports = composePlugins(withNx(), withWeb(), (config, context) => {
        return config;
      });
    `
    );
    runCLI(`build ${appName} --outputHashing=none`);
    checkFilesExist(`dist/apps/${appName}/main.js`);

    rmDist();

    // Return async function
    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const { composePlugins, withNx, withWeb } = require('@nx/webpack');
      module.exports = composePlugins(withNx(), withWeb(), async (config, context) => {
        return config;
      });
    `
    );
    runCLI(`build ${appName} --outputHashing=none`);
    checkFilesExist(`dist/apps/${appName}/main.js`);

    rmDist();

    // Return promise of function
    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const { composePlugins, withNx, withWeb } = require('@nx/webpack');
      module.exports = composePlugins(withNx(), withWeb(), Promise.resolve((config, context) => {
        return config;
      }));
    `
    );
    runCLI(`build ${appName} --outputHashing=none`);
    checkFilesExist(`dist/apps/${appName}/main.js`);
  }, 100000);
});

describe('Build Options (legacy) ', () => {
  it('should inject/bundle external scripts and styles', async () => {
    newProject();

    const appName = uniq('app');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

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

    updateJson(join('apps', appName, 'project.json'), (config) => {
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

    runCLI(`build ${appName} --optimization=false --outputHashing=none`);

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

describe('index.html interpolation (legacy)', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  test('should interpolate environment variables', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
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

    updateJson(join('apps', appName, 'project.json'), (config) => {
      const buildOptions = config.targets.build.options;
      buildOptions.deployUrl = 'baz';
      return config;
    });

    runCLI(`build ${appName}`);

    const distPath = `dist/apps/${appName}`;
    const resultIndexContents = readFile(`${distPath}/index.html`);

    expect(resultIndexContents).toMatch(/Nx Variable: foo/);
  });
});
