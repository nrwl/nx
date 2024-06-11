import {
  checkFilesExist,
  cleanupProject,
  fileExists,
  listFiles,
  newProject,
  packageInstall,
  readFile,
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

  it('should be able to setup project to build node programs with webpack and different compilers', async () => {
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
      const path  = require('path');
      const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
      
      class DebugPlugin {
        apply(compiler) {
          console.log('scriptType is ' + compiler.options.output.scriptType);
        }
      }

      module.exports = {
        target: 'node',
        output: {
          path: path.join(__dirname, '../../dist/libs/${myPkg}')
        },
        plugins: [
          new NxAppWebpackPlugin({
            compiler: 'tsc',
            main: './src/index.ts',
            tsConfig: './tsconfig.lib.json',
            outputHashing: 'none',
            optimization: false,
          }),
          new DebugPlugin()
        ]
      };`
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
          })
        ]
      };`
    );

    runCLI(`build ${appName}`);

    let output = runCommand(`node dist/${appName}/main.js`);
    expect(output).toMatch(/Hello/);
  }, 500_000);

  it('should bundle in NX_PUBLIC_ environment variables', () => {
    const appName = uniq('app');
    runCLI(`generate @nx/web:app ${appName} --bundler webpack`);
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

  it('should support babel + core-js to polyfill JS features', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler webpack --compiler=babel`
    );
    packageInstall('core-js', undefined, '3.26.1', 'prod');
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

  it('should allow options to be passed from the executor', async () => {
    const appName = uniq('app');
    runCLI(`generate @nx/web:app ${appName} --bundler webpack`);
    updateJson(`apps/${appName}/project.json`, (json) => {
      json.targets.build = {
        executor: '@nx/webpack:webpack',
        outputs: ['{options.outputPath}'],
        options: {
          generatePackageJson: true, // This should be passed to the plugin.
          outputPath: `dist/apps/${appName}`,
          webpackConfig: `apps/${appName}/webpack.config.js`,
        },
      };
      return json;
    });
    updateFile(
      `apps/${appName}/webpack.config.js`,
      `
        const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { join } = require('path');
        module.exports = {
          output: {
            path: join(__dirname, '../../dist/apps/demo'),
          },
          plugins: [
            new NxAppWebpackPlugin({
              // NOTE: generatePackageJson is missing here, but executor passes it.
              target: 'web',
              compiler: 'swc',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              optimization: false,
              outputHashing: 'none',
            }),
          ],
        };`
    );

    runCLI(`build ${appName}`);

    fileExists(`dist/apps/${appName}/package.json`);
  });

  it('should resolve assets from executors as relative to workspace root', () => {
    const appName = uniq('app');
    runCLI(`generate @nx/web:app ${appName} --bundler webpack`);
    updateFile('shared/docs/TEST.md', 'TEST');
    updateJson(`apps/${appName}/project.json`, (json) => {
      json.targets.build = {
        executor: '@nx/webpack:webpack',
        outputs: ['{options.outputPath}'],
        options: {
          assets: [
            {
              input: 'shared/docs',
              glob: 'TEST.md',
              output: '.',
            },
          ],
          outputPath: `dist/apps/${appName}`,
          webpackConfig: `apps/${appName}/webpack.config.js`,
        },
      };
      return json;
    });

    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/TEST.md`);
  });

  it('it should support building libraries and apps when buildLibsFromSource is false', () => {
    const appName = uniq('app');
    const myPkg = uniq('my-pkg');

    runCLI(`generate @nx/web:application ${appName}`);

    runCLI(`generate @nx/js:lib ${myPkg} --importPath=@${appName}/${myPkg}`);

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

function readMainFile(dir: string): string {
  const main = listFiles(dir).find((f) => f.startsWith('main.'));
  return readFile(`${dir}/${main}`);
}
