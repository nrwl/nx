import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson } from '@nx/devkit';
import initGenerator from './init';

describe('Remix Init Generator', () => {
  describe('NX_PCV3=false', () => {
    it('should setup the workspace and add dependencies', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await initGenerator(tree, {});

      // ASSERT
      const pkgJson = readJson(tree, 'package.json');
      expect(pkgJson.dependencies).toMatchInlineSnapshot(`
        {
          "@remix-run/serve": "^2.3.0",
        }
      `);
      expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
        {
          "@remix-run/dev": "^2.3.0",
        }
      `);
    });
  });

  describe('NX_PCV3=true', () => {
    it('should setup the workspace and add dependencies', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      process.env.NX_PCV3 = 'true';
      // ACT
      await initGenerator(tree, {});

      // ASSERT
      const pkgJson = readJson(tree, 'package.json');
      expect(pkgJson.dependencies).toMatchInlineSnapshot(`
        {
          "@remix-run/serve": "^2.3.0",
        }
      `);
      expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
        {
          "@remix-run/dev": "^2.3.0",
        }
      `);

      const nxJson = readJson(tree, 'nx.json');
      expect(nxJson.plugins).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "buildTargetName": "build",
              "serveTargetName": "serve",
              "startTargetName": "start",
              "typecheckTargetName": "typecheck",
            },
            "plugin": "@nx/remix/plugin",
          },
        ]
      `);
    });
  });
});
