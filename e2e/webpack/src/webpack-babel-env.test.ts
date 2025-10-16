import { runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest(['@nx/js', '@nx/webpack']);

  it('should use either BABEL_ENV or NODE_ENV value for Babel environment configuration', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=none`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    runCLI(
      `generate @nx/webpack:configuration ${myPkg} --target=node --compiler=babel --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );

    updateFile(
      `libs/${myPkg}/.babelrc`,
      `{ 'presets': ['@nx/js/babel', './custom-preset'] } `
    );
    updateFile(
      `libs/${myPkg}/custom-preset.js`,
      `
      module.exports = function(api, opts) {
        console.log('Babel env is ' + api.env());
        return opts;
      }
    `
    );

    let output = runCLI(`build ${myPkg}`, {
      env: {
        NODE_ENV: 'nodeEnv',
        BABEL_ENV: 'babelEnv',
      },
    });
    expect(output).toContain('Babel env is babelEnv');
  }, 500_000);
});
