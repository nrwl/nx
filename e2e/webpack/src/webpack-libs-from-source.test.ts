import { runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest();

  it('it should support building libraries and apps when buildLibsFromSource is false', () => {
    const appName = uniq('app');
    const myPkg = uniq('my-pkg');

    runCLI(
      `generate @nx/web:application ${appName} --directory=apps/${appName}`
    );

    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --importPath=@${appName}/${myPkg}`
    );

    updateFile(`libs/${myPkg}/src/index.ts`, `export const foo = 'bar';\n`);

    updateFile(
      `apps/${appName}/src/main.ts`,
      `import { foo } from '@${appName}/${myPkg}';\nconsole.log(foo);\n`
    );

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const path  = require('path');
      const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');

      module.exports = {
        target: 'node',
        output: {
          path: path.join(__dirname, '../../dist/${appName}')
        },
        plugins: [
          new NxAppWebpackPlugin({
            compiler: 'tsc',
            main: 'apps/${appName}/src/main.ts',
            tsConfig: 'apps/${appName}/tsconfig.app.json',
            outputHashing: 'none',
            optimization: false,
            buildLibsFromSource: false,
          })
        ]
      };`
    );

    const result = runCLI(`build ${appName}`);

    expect(result).toContain(
      `Running target build for project ${appName} and 1 task it depends on`
    );
    expect(result).toContain(`nx run ${myPkg}:build`);
    expect(result).toContain(
      `Successfully ran target build for project ${appName} and 1 task it depends on`
    );
  });
});
