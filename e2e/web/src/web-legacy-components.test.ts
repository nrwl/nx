import {
  checkFilesDoNotExist,
  checkFilesExist,
  createFile,
  readFile,
  rmDist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupWebLegacyTest, cleanupWebLegacyTest } from './web-legacy-setup';

describe('Web Components Applications (legacy)', () => {
  beforeEach(() => setupWebLegacyTest());
  afterEach(() => cleanupWebLegacyTest());

  it('should remove previous output before building', async () => {
    const appName = uniq('app');
    const libName = uniq('lib');

    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive --compiler swc`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );
    runCLI(
      `generate @nx/react:lib libs/${libName} --bundler=rollup --no-interactive --compiler swc --unitTestRunner=jest`,
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

    // Asset that React runtime is imported
    expect(readFile(`dist/libs/${libName}/index.esm.js`)).toMatch(
      /react\/jsx-runtime/
    );
  }, 120000);

  it('should support custom webpackConfig option', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive`,
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
