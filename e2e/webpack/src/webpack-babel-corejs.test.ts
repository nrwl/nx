import {
  checkFilesExist,
  listFiles,
  packageInstall,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest(['@nx/web', '@nx/webpack']);

  it('should support babel + core-js to polyfill JS features', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --directory=apps/${appName} --bundler webpack --compiler=babel`
    );
    packageInstall('core-js', undefined, '3.26.1', 'prod');

    checkFilesExist(`apps/${appName}/src/main.ts`);
    updateFile(
      `apps/${appName}/src/main.ts`,
      `
      import 'core-js/stable';
      async function main() {
        const result = await Promise.resolve('foobar')
        console.log(result);
      }
      main();
    `
    );

    // Modern browser
    updateFile(`apps/${appName}/.browserslistrc`, `last 1 Chrome version\n`);
    runCLI(`build ${appName}`);
    expect(readMainFile(`dist/apps/${appName}`)).toMatch(`await Promise`);

    // Legacy browser
    updateFile(`apps/${appName}/.browserslistrc`, `IE 11\n`);
    runCLI(`build ${appName}`);
    expect(readMainFile(`dist/apps/${appName}`)).not.toMatch(`await Promise`);
  });
});

function readMainFile(dir: string): string {
  const main = listFiles(dir).find((f) => f.startsWith('main.'));
  return readFile(`${dir}/${main}`);
}
