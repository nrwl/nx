import { createFile, readFile, runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { setupWebTest } from './web-setup';

describe('index.html interpolation', () => {
  setupWebTest();

  test('should interpolate environment variables', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive --unitTestRunner=vitest --linter=eslint`
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
        <div>Nx Variable: %NX_PUBLIC_VARIABLE%</div>
        <div>Some other variable: %SOME_OTHER_VARIABLE%</div>
      </body>
    </html>
`;
    const envFilePath = `apps/${appName}/.env`;
    const envFileContents = `
      NX_PUBLIC_VARIABLE=foo
      SOME_OTHER_VARIABLE=bar
    `;

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
