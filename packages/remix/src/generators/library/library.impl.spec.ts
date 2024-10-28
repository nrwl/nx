import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application.impl';
import libraryGenerator from './library.impl';

describe('Remix Library Generator', () => {
  it('should generate a library correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await libraryGenerator(tree, {
      directory: 'test',
      style: 'css',
      addPlugin: true,
    });

    // ASSERT
    const tsconfig = readJson(tree, 'tsconfig.base.json');
    expect(tree.exists(`test/src/server.ts`));
    expect(tree.children(`test/src/lib`)).toMatchSnapshot();
    expect(tsconfig.compilerOptions.paths).toMatchSnapshot();
  }, 25_000);

  describe('Standalone Project Repo', () => {
    it('should update the tsconfig paths correctly', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      await applicationGenerator(tree, {
        name: 'demo',
        directory: '.',
        rootProject: true,
        addPlugin: true,
      });
      const originalBaseTsConfig = readJson(tree, 'tsconfig.json');

      // ACT
      await libraryGenerator(tree, {
        directory: 'test',
        style: 'css',
        addPlugin: true,
      });

      // ASSERT
      const updatedBaseTsConfig = readJson(tree, 'tsconfig.base.json');
      expect(Object.keys(originalBaseTsConfig.compilerOptions.paths)).toContain(
        '~/*'
      );
      expect(Object.keys(updatedBaseTsConfig.compilerOptions.paths)).toContain(
        '~/*'
      );
    });
  });

  describe('--unitTestRunner', () => {
    it('should not create config files when unitTestRunner=none', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await libraryGenerator(tree, {
        directory: 'test',
        style: 'css',
        unitTestRunner: 'none',
        addPlugin: true,
      });

      // ASSERT
      expect(tree.exists(`test/jest.config.ts`)).toBeFalsy();
      expect(tree.exists(`test/vite.config.ts`)).toBeFalsy();
    });

    it('should create the correct config files for testing with jest', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await libraryGenerator(tree, {
        directory: 'test',
        style: 'css',
        unitTestRunner: 'jest',
        addPlugin: true,
      });

      // ASSERT
      expect(tree.read(`test/jest.config.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/src/test-setup.ts`, 'utf-8')).toMatchSnapshot();
    });

    it('should create the correct config files for testing with vitest', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await libraryGenerator(tree, {
        directory: 'test',
        style: 'css',
        unitTestRunner: 'vitest',
        addPlugin: true,
      });

      // ASSERT
      expect(tree.read(`test/vite.config.ts`, 'utf-8')).toMatchSnapshot();

      expect(tree.read(`test/src/test-setup.ts`, 'utf-8')).toMatchSnapshot();
    }, 25_000);
  });

  // TODO(Colum): Unskip this when buildable is investigated correctly
  xit('should generate the config files correctly when the library is buildable', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await libraryGenerator(tree, {
      directory: 'test',
      style: 'css',
      buildable: true,
      addPlugin: true,
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    const pkgJson = readJson(tree, `test/package.json`);
    expect(project.targets.build.options.format).toEqual(['cjs']);
    expect(project.targets.build.options.outputPath).toEqual(`test/dist`);
    expect(pkgJson.main).toEqual('./dist/index.cjs.js');
    expect(pkgJson.typings).toEqual('./dist/index.d.ts');
  });
});
