import {
  addProjectConfiguration,
  stripIndents,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { spectatorComponentGenerator } from './spectator-component';

describe('spectator component Generator', () => {
  const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

  beforeAll(async () => {
    // ARRANGE
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
     import { NgModule } from '@angular/core';
     
     @NgModule({
       declarations: [],
       exports: []
     })
     export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');
  });

  it('should create component files correctly', async () => {
    // ACT
    await spectatorComponentGenerator(tree, {
      name: 'example',
      project: 'lib1',
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8')
    ).toMatchSnapshot('component');
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.html', 'utf-8')
    ).toMatchSnapshot('template');
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.css', 'utf-8')
    ).toMatchSnapshot('stylesheet');
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.spec.ts', 'utf-8')
    ).toMatchSnapshot('component test file');
    expect(tree.read('libs/lib1/src/index.ts', 'utf-8')).toMatchSnapshot(
      'entry point file'
    );
  });

  it('should not generate test file when --skip-tests=true', async () => {
    // ACT
    await spectatorComponentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.exists('libs/lib1/src/lib/example/example.component.spec.ts')
    ).toBe(false);
  });

  describe('component', () => {
    it('should generate tests using jest', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        jest: true,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).toContain('jest');
    });

    it('should not generate tests using jest', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        jest: false,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).not.toContain('jest');
    });
  });

  describe('componentCustomHost', () => {
    it('should generate tests using jest', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withCustomHost: true,
        jest: true,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).toContain('jest');
    });

    it('should not generate tests using jest', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withCustomHost: true,
        jest: false,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).not.toContain('jest');
    });

    it('should not generate tests using host', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withCustomHost: true,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).toContain('CustomHostComponent');
    });
  });

  describe('componentHost', () => {
    it('should generate tests using jest', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withHost: true,
        jest: true,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).toContain('jest');
    });

    it('should not generate tests using jest', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withHost: true,
        jest: false,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).not.toContain('jest');
    });

    it('should not generate tests using host', async () => {
      // ACT
      await spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withHost: true,
      });

      // ASSERT
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).toContain('createHostFactory');
    });
  });

  it('should throw error when both withHost, withCustomHost are provided', async () => {
    // ACT & ASSERT
    await expect(
      spectatorComponentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        withHost: true,
        withCustomHost: true,
      })
    ).rejects.toThrow(
      'The provided options are invalid. Please provide either withCustomHost or withHost.'
    );
  });
});
