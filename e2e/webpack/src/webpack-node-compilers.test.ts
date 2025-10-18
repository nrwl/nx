import {
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest();

  it('should be able to setup project to build node programs with webpack and different compilers', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=none`
    );
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
});
