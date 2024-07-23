import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

describe('@nx/gradle:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('settings.gradle', '');
  });

  describe('plugin', () => {
    it('should add the plugin', async () => {
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson.plugins).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "buildTargetName": "build",
              "classesTargetName": "classes",
              "testTargetName": "test",
            },
            "plugin": "@nx/gradle",
          },
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
      expect(nxJson.plugins).toMatchInlineSnapshot(`
        [
          "foo",
          {
            "options": {
              "buildTargetName": "build",
              "classesTargetName": "classes",
              "testTargetName": "test",
            },
            "plugin": "@nx/gradle",
          },
        ]
      `);
    });

    it('should not add plugin if already in array', async () => {
      updateNxJson(tree, {
        plugins: ['@nx/gradle'],
      });
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson.plugins).toMatchInlineSnapshot(`
              [
                "@nx/gradle",
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
      expect(nxJson.namedInputs).toMatchInlineSnapshot(`
        {
          "default": [
            "{projectRoot}/**/*",
          ],
          "production": [
            "default",
            "!{projectRoot}/src/test/**/*",
          ],
        }
      `);
    });

    it('should not overwrite existing namedInputs', async () => {
      updateNxJson(tree, {
        namedInputs: {
          default: ['foo'],
          production: [
            'bar',
            '!{projectRoot}/cypress/**/*',
            '!{projectRoot}/**/*.cy.[jt]s?(x)',
            '!{projectRoot}/cypress.config.[jt]s',
            '!{projectRoot}/src/test/**/*',
          ],
        },
      });
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: false,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson.namedInputs).toMatchInlineSnapshot(`
        {
          "default": [
            "foo",
            "{projectRoot}/**/*",
          ],
          "production": [
            "bar",
            "!{projectRoot}/cypress/**/*",
            "!{projectRoot}/**/*.cy.[jt]s?(x)",
            "!{projectRoot}/cypress.config.[jt]s",
            "!{projectRoot}/src/test/**/*",
            "default",
          ],
        }
      `);
    });
  });
});
