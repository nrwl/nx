import {
  createFile,
  newProject,
  cleanupProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('index.html interpolation (legacy)', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  test('should interpolate environment variables', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive`,
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
        <div>Nx Variable: %NX_PUBLIC_VARIABLE%</div>
        <div>Some other variable: %SOME_OTHER_VARIABLE%</div>
        <div>Deploy Url: %DEPLOY_URL%</div>
      </body>
    </html>
`;
    const envFilePath = `apps/${appName}/.env`;
    const envFileContents = `
      NX_PUBLIC_VARIABLE=foo
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
