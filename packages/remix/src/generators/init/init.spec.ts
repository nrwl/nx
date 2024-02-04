import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson } from '@nx/devkit';
import initGenerator from './init';

describe('Remix Init Generator', () => {
  it('should setup the workspace and add dependencies', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await initGenerator(tree, {
      addPlugin: true,
    });

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
        {
          "@remix-run/serve": "^2.3.0",
        }
      `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
        {
          "@nx/web": "0.0.1",
          "@remix-run/dev": "^2.3.0",
        }
      `);
  });

  describe('NX_ADD_PLUGINS=false', () => {
    it('should setup the workspace and add dependencies', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      process.env.NX_ADD_PLUGINS = 'false';
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
          "@nx/web": "0.0.1",
          "@remix-run/dev": "^2.3.0",
        }
      `);
    });
  });
});
