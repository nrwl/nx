import {
  checkFilesExist,
  cleanupProject,
  newProject,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Webpack Plugin', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  // TODO(crystal, @jaysoo): Investigate why this test is failing
  xit('should be able to setup project to build node programs with webpack and different compilers', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(`generate @nx/js:lib ${myPkg} --bundler=none`);
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    runCLI(
      `generate @nx/webpack:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );

    // Test `scriptType` later during during.
    updateFile(
      `libs/${myPkg}/webpack.config.js`,
      `
const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => {
  console.log('scriptType is ' + config.output.scriptType);
  return config;
});
`
    );

    rmDist();

    const buildOutput = runCLI(`build ${myPkg}`);
    // Ensure scriptType is not set if we're in Node (it only applies to Web).
    expect(buildOutput).toContain('scriptType is undefined');
    let output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);
    expect(output).not.toMatch(/Conflicting/);
    expect(output).not.toMatch(/process.env.NODE_ENV/);

    updateJson(join('libs', myPkg, 'project.json'), (config) => {
      delete config.targets.build;
      return config;
    });

    // swc
    runCLI(
      `generate @nx/webpack:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=swc`
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);

    updateJson(join('libs', myPkg, 'project.json'), (config) => {
      delete config.targets.build;
      return config;
    });

    // tsc
    runCLI(
      `generate @nx/webpack:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=tsc`
    );
    rmDist();
    runCLI(`build ${myPkg}`);
    output = runCommand(`node dist/libs/${myPkg}/main.js`);
    expect(output).toMatch(/Hello/);
  }, 500000);

  it('should use either BABEL_ENV or NODE_ENV value for Babel environment configuration', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(`generate @nx/js:lib ${myPkg} --bundler=none`);
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

  it('should be able to build with NxWebpackPlugin and a standard webpack config file', () => {
    const appName = uniq('app');
    runCLI(`generate @nx/web:app ${appName} --bundler webpack`);
    updateFile(`apps/${appName}/src/main.ts`, `console.log('Hello');\n`);

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
      const path  = require('path');
      const { NxWebpackPlugin } = require('@nx/webpack');

      module.exports = {
        target: 'node',
        output: {
          path: path.join(__dirname, '../../dist/${appName}')
        },
        plugins: [
          new NxWebpackPlugin({
            compiler: 'tsc',
            main: 'apps/${appName}/src/main.ts',
            tsConfig: 'apps/${appName}/tsconfig.app.json',
            outputHashing: 'none',
            optimization: false,
          })
        ]
      };`
    );

    runCLI(`build ${appName}`);

    let output = runCommand(`node dist/${appName}/main.js`);
    expect(output).toMatch(/Hello/);
  }, 500_000);

  // Issue: https://github.com/nrwl/nx/issues/20179
  // TODO(crystal, @jaysoo): Investigate why this test is failing
  xit('should allow main/styles entries to be spread within composePlugins() function (#20179)', () => {
    const appName = uniq('app');
    runCLI(`generate @nx/web:app ${appName} --bundler webpack`);
    updateFile(`apps/${appName}/src/main.ts`, `console.log('Hello');\n`);

    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
        const { composePlugins, withNx, withWeb } = require('@nx/webpack');
        module.exports = composePlugins(withNx(), withWeb(), (config) => {
          return {
            ...config,
            entry: {
              main: [...config.entry.main],
              styles: [...config.entry.styles],
            }
          };
        });
      `
    );

    expect(() => {
      runCLI(`build ${appName} --outputHashing none`);
    }).not.toThrow();
    checkFilesExist(`dist/apps/${appName}/styles.css`);

    expect(() => {
      runCLI(`build ${appName} --outputHashing none --extractCss false`);
    }).not.toThrow();
    expect(() => {
      checkFilesExist(`dist/apps/${appName}/styles.css`);
    }).toThrow();
  });
});
