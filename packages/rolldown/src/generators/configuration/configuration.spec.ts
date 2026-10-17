import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { configurationGenerator } from './configuration';

describe('configurationGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    });
    tree.write('apps/api/src/main.ts', 'console.log("hi");');
    tree.write('apps/api/tsconfig.app.json', '{}');
  });

  it('should write a rolldown config and register the plugin', async () => {
    await configurationGenerator(tree, { project: 'api' });

    expect(tree.read('apps/api/rolldown.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { defineConfig } from 'rolldown';
        // eslint-disable-next-line @nx/enforce-module-boundaries
        import packageJson from '../../package.json' with { type: 'json' };

        // Installed at runtime instead of bundled (native addons, dynamic requires).
        const dependencies = Object.keys(packageJson.dependencies);

        export default defineConfig([
          {
            input: 'src/main.ts',
            platform: 'node',
            tsconfig: 'tsconfig.app.json',
            external: (id) => dependencies.some((dep) => id === dep || id.startsWith(\`\${dep}/\`)),
            output: {
              dir: '../../dist/apps/api',
              cleanDir: true,
              format: 'esm',
              sourcemap: true,
            },
          },
        ]);
        "
      `);
    expect(
      readNxJson(tree).plugins.some(
        (p) => typeof p !== 'string' && p.plugin === '@nx/rolldown/plugin'
      )
    ).toBe(true);
    expect(readProjectConfiguration(tree, 'api').targets).toEqual({});
  });

  it('should output to <projectRoot>/dist in a TS solution workspace', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['apps/*'];
      return json;
    });
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: { composite: true, declaration: true },
      })
    );
    tree.write(
      'tsconfig.json',
      JSON.stringify({
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      })
    );

    await configurationGenerator(tree, {
      project: 'api',
      format: 'cjs',
    });

    const config = tree.read('apps/api/rolldown.config.ts', 'utf-8');
    expect(config).toContain(`dir: 'dist'`);
    expect(config).toContain(`format: 'cjs'`);
  });

  it('should read external dependencies from the project package.json', async () => {
    tree.write('apps/api/package.json', '{"name":"api"}');

    await configurationGenerator(tree, { project: 'api' });

    expect(tree.read('apps/api/rolldown.config.ts', 'utf-8')).toContain(
      "import packageJson from './package.json' with { type: 'json' };"
    );
  });

  it.each([
    [{ externalDependencies: false }],
    [{ platform: 'browser' as const }],
  ])('should bundle dependencies for %j', async (extra) => {
    await configurationGenerator(tree, {
      project: 'api',
      ...extra,
    });

    const config = tree.read('apps/api/rolldown.config.ts', 'utf-8');
    expect(config).not.toContain('external');
    expect(config).not.toContain('package.json');
  });

  it('should throw if the project already has a rolldown config', async () => {
    tree.write('apps/api/rolldown.config.mjs', 'export default {};');

    await expect(
      configurationGenerator(tree, { project: 'api' })
    ).rejects.toThrow(/already has a Rolldown config/);
  });
});
