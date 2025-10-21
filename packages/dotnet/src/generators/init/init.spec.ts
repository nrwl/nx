import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

describe('@nx/dotnet:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('MyApp/MyApp.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
  });

  describe('plugin', () => {
    it('should add the plugin', async () => {
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson?.plugins).toMatchInlineSnapshot(`
        [
          "@nx/dotnet",
        ]
      `);
    });

    it('should not overwrite existing plugins', async () => {
      updateNxJson(tree, {
        plugins: ['foo'],
      });
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson?.plugins).toMatchInlineSnapshot(`
        [
          "foo",
          "@nx/dotnet",
        ]
      `);
    });

    it('should not add plugin if already in array', async () => {
      updateNxJson(tree, {
        plugins: ['@nx/dotnet'],
      });
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson?.plugins).toMatchInlineSnapshot(`
        [
          "@nx/dotnet",
        ]
      `);
    });
  });

  describe('namedInputs', () => {
    it('should add the namedInputs', async () => {
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson?.namedInputs).toMatchInlineSnapshot(`
        {
          "default": [
            "{projectRoot}/**/*",
          ],
          "production": [
            "default",
            "!{projectRoot}/**/*.Tests/**/*",
            "!{projectRoot}/**/bin/**/*",
            "!{projectRoot}/**/obj/**/*",
          ],
        }
      `);
    });

    it('should not overwrite existing namedInputs', async () => {
      updateNxJson(tree, {
        namedInputs: {
          default: ['foo'],
          production: ['bar', '!{projectRoot}/cypress/**/*'],
        },
      });
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson?.namedInputs).toMatchInlineSnapshot(`
        {
          "default": [
            "foo",
            "{projectRoot}/**/*",
          ],
          "production": [
            "bar",
            "!{projectRoot}/cypress/**/*",
            "default",
            "!{projectRoot}/**/*.Tests/**/*",
            "!{projectRoot}/**/bin/**/*",
            "!{projectRoot}/**/obj/**/*",
          ],
        }
      `);
    });
  });
});
