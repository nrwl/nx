import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  ProjectGraph,
  readJson,
  readNxJson,
  stripIndents,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';
import { initGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/vite:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
  });

  describe('dependencies for package.json', () => {
    it('should add required packages', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        addPlugin: true,
      });
      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();
    });
  });

  describe('vitest targets', () => {
    it('should add target defaults for test', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.production = ['default'];
        return json;
      });

      await initGenerator(tree, {
        addPlugin: true,
      });

      const nxJson = readNxJson(tree);

      expect(nxJson).toMatchInlineSnapshot(`
        {
          "affected": {
            "defaultBase": "main",
          },
          "namedInputs": {
            "production": [
              "default",
              "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
              "!{projectRoot}/tsconfig.spec.json",
              "!{projectRoot}/src/test-setup.[jt]s",
            ],
          },
          "plugins": [
            {
              "options": {
                "buildDepsTargetName": "build-deps",
                "buildTargetName": "build",
                "devTargetName": "dev",
                "previewTargetName": "preview",
                "serveStaticTargetName": "serve-static",
                "serveTargetName": "serve",
                "testTargetName": "test",
                "typecheckTargetName": "typecheck",
                "watchDepsTargetName": "watch-deps",
              },
              "plugin": "@nx/vite/plugin",
            },
          ],
          "targetDefaults": {
            "build": {
              "cache": true,
            },
            "lint": {
              "cache": true,
            },
          },
        }
      `);
    });
  });

  it('should add nxViteTsPaths plugin to vite config files when setupPathsPlugin is set to true', async () => {
    tree.write(
      'proj/vite.config.ts',
      stripIndents`
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    export default defineConfig({
      plugins: [react()],
    })`
    );

    await initGenerator(tree, {
      addPlugin: true,
      setupPathsPlugin: true,
    });

    expect(tree.read('proj/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      export default defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });
      "
    `);
  });

  it('should ignore vite temp files in gitignore', async () => {
    await initGenerator(tree, {});

    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      "vite.config.*.timestamp*
      vitest.config.*.timestamp*"
    `);
  });

  it(`should not add multiple instances of the same vite temp file glob to gitignore`, async () => {
    // ARRANGE
    tree.write(
      '.gitignore',
      `vitest.config.*.timestamp*
vite.config.*.timestamp*`
    );

    // ACT
    await initGenerator(tree, {});

    // ASSERT
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      "vitest.config.*.timestamp*
      vite.config.*.timestamp*"
    `);
  });

  it('should ignore vite temp files in eslint flat config without a block with ignores', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { eslint: '9.0.0' };
      return json;
    });
    tree.write('eslint.config.mjs', `export default [];`);

    await initGenerator(tree, {});

    expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
      "export default [
        {
          ignores: ['**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
        },
      ];
      "
    `);
  });

  it('should ignore vite temp files in eslint flat config with a block with ignores', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { eslint: '9.0.0' };
      return json;
    });
    tree.write(
      'eslint.config.mjs',
      `export default [
      {
        ignores: ['dist'],
      },
    ];`
    );

    await initGenerator(tree, {});

    expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
      "export default [
        {
          ignores: [
            'dist',
            '**/vite.config.*.timestamp*',
            '**/vitest.config.*.timestamp*',
          ],
        },
      ];
      "
    `);
  });

  it('should not duplicate vite temp files in eslint flat config', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { eslint: '9.0.0' };
      return json;
    });
    tree.write(
      'eslint.config.mjs',
      `export default [
      {
        ignores: ['**/vitest.config.*.timestamp*', '**/vite.config.*.timestamp*'],
      },
    ];`
    );

    await initGenerator(tree, {});

    expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
      "export default [
        {
          ignores: ['**/vitest.config.*.timestamp*', '**/vite.config.*.timestamp*'],
        },
      ];
      "
    `);
  });

  it('should ignore vite temp files in project eslintrc config without ignorePatterns', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { eslint: '9.0.0' };
      return json;
    });
    tree.write('.eslintrc.json', JSON.stringify({ ignorePatterns: ['**/*'] }));
    tree.write('apps/my-app/.eslintrc.json', `{}`);

    await initGenerator(tree, { projectRoot: 'apps/my-app' });

    expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "ignorePatterns": [
          "**/*",
        ],
      }
    `);
    expect(readJson(tree, 'apps/my-app/.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "ignorePatterns": [
          "**/vite.config.*.timestamp*",
          "**/vitest.config.*.timestamp*",
        ],
      }
    `);
  });

  it('should ignore vite temp files in project eslintrc config with ignorePatterns config', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { eslint: '9.0.0' };
      return json;
    });
    tree.write('.eslintrc.json', JSON.stringify({ ignorePatterns: ['**/*'] }));
    tree.write(
      'apps/my-app/.eslintrc.json',
      JSON.stringify({ ignorePatterns: ['!**/*'] })
    );

    await initGenerator(tree, { projectRoot: 'apps/my-app' });

    expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "ignorePatterns": [
          "**/*",
        ],
      }
    `);
    expect(readJson(tree, 'apps/my-app/.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "ignorePatterns": [
          "!**/*",
          "**/vite.config.*.timestamp*",
          "**/vitest.config.*.timestamp*",
        ],
      }
    `);
  });

  it('should not duplicate vite temp files in project eslintrc config', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { eslint: '9.0.0' };
      return json;
    });
    tree.write('.eslintrc.json', JSON.stringify({ ignorePatterns: ['**/*'] }));
    tree.write(
      'apps/my-app/.eslintrc.json',
      JSON.stringify({
        ignorePatterns: [
          '!**/*',
          '**/vitest.config.*.timestamp*',
          '**/vite.config.*.timestamp*',
        ],
      })
    );

    await initGenerator(tree, { projectRoot: 'apps/my-app' });

    expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "ignorePatterns": [
          "**/*",
        ],
      }
    `);
    expect(readJson(tree, 'apps/my-app/.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "ignorePatterns": [
          "!**/*",
          "**/vitest.config.*.timestamp*",
          "**/vite.config.*.timestamp*",
        ],
      }
    `);
  });
});
