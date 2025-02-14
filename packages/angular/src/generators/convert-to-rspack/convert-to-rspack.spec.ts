import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToRspack } from './convert-to-rspack';
import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
} from '@nx/devkit';

describe('convert-to-rspack', () => {
  it('should convert a basic angular webpack application to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['zone.js'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { createConfig } = require('@ng-rspack/build');

      module.exports = createConfig({
        root: __dirname,
        index: './src/index.html',
        browser: './src/main.ts',

        tsconfigPath: './tsconfig.app.json',
        polyfills: ['zone.js'],
        assets: ['./src/favicon.ico', './src/assets', './public'],
        styles: ['./src/styles.scss'],
        scripts: [],
        jit: false,
        inlineStylesExtension: 'css',
        fileReplacements: [],
        hasServer: false,
        skipTypeChecking: false,
      });
      "
    `);
    expect(pkgJson.devDependencies['@ng-rspack/build']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });
});
