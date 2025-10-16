import {
  checkFilesExist,
  listFiles,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest(['@nx/web', '@nx/webpack']);

  it('should bundle in NX_PUBLIC_ environment variables', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --directory=apps/${appName} --bundler webpack`
    );

    checkFilesExist(`apps/${appName}/src/main.ts`);
    updateFile(
      `apps/${appName}/src/main.ts`,
      `
      console.log(process.env['NX_PUBLIC_TEST']);
      `
    );

    runCLI(`build ${appName}`, {
      env: {
        NX_PUBLIC_TEST: 'foobar',
      },
    });

    const mainFile = listFiles(`dist/apps/${appName}`).filter((f) =>
      f.startsWith('main.')
    );
    const content = readFile(`dist/apps/${appName}/${mainFile}`);
    expect(content).toMatch(/foobar/);
  });
});
