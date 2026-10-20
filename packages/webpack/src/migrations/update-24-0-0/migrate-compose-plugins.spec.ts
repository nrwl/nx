import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateComposePlugins from './migrate-compose-plugins';

const LITERAL_CONFIG = `const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(
  withNx({ main: './src/main.ts', tsConfig: './tsconfig.app.json' }),
  (config) => config
);
`;

const NON_LITERAL_CONFIG = `const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');

module.exports = composePlugins(
  withNx({ main: join(__dirname, 'src/main.ts') }),
  (config) => config
);
`;

describe('migrate-compose-plugins', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'package.json',
      JSON.stringify({ devDependencies: { webpack: '5.100.0' } })
    );
  });

  function addExecutorProject(name: string, config: string) {
    addProjectConfiguration(tree, name, {
      root: name,
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { webpackConfig: `${name}/webpack.config.js` },
        },
      },
    });
    tree.write(`${name}/webpack.config.js`, config);
  }

  it('should skip the prompt when nothing uses the removed helpers', async () => {
    addProjectConfiguration(tree, 'app1', { root: 'app1', targets: {} });
    tree.write('app1/webpack.config.js', `module.exports = { plugins: [] };\n`);

    expect(await migrateComposePlugins(tree)).toEqual({ skipAgentic: true });
  });

  it('should convert an executor project and hand the leftover old config to the prompt', async () => {
    addExecutorProject('app1', LITERAL_CONFIG);

    const result = await migrateComposePlugins(tree);

    expect(tree.exists('app1/webpack.config.old.js')).toBe(true);
    expect(tree.read('app1/webpack.config.js', 'utf-8')).toContain(
      'useLegacyNxPlugin'
    );
    expect(result.nextSteps).toEqual([
      'Inline the `webpack.config.old.*` files that @nx/webpack:convert-config-to-webpack-plugin left behind in 1 project(s), then drop `useLegacyNxPlugin`.',
    ]);
    expect(result.agentContext.join('\n')).toContain(
      '- app1 (app1): app1/webpack.config.js'
    );
  });

  it('should leave a config with non-literal withNx options untouched for the prompt', async () => {
    addExecutorProject('app1', NON_LITERAL_CONFIG);

    const result = await migrateComposePlugins(tree);

    expect(tree.exists('app1/webpack.config.old.js')).toBe(false);
    expect(tree.read('app1/webpack.config.js', 'utf-8')).toEqual(
      NON_LITERAL_CONFIG
    );
    expect(result.nextSteps).toEqual([
      'Migrate 1 project(s) off the removed webpack config helpers by hand: app1.',
    ]);
    expect(result.agentContext.join('\n')).toContain(
      'They must be a plain object literal'
    );
  });

  it('should convert a project already on the inference plugin', async () => {
    addProjectConfiguration(tree, 'app1', { root: 'app1', targets: {} });
    tree.write('app1/webpack.config.js', LITERAL_CONFIG);

    const result = await migrateComposePlugins(tree);

    expect(tree.exists('app1/webpack.config.old.js')).toBe(true);
    expect(tree.read('app1/webpack.config.js', 'utf-8')).toContain(
      'useLegacyNxPlugin'
    );
    expect(result.nextSteps).toEqual([
      'Inline the `webpack.config.old.*` files that @nx/webpack:convert-config-to-webpack-plugin left behind in 1 project(s), then drop `useLegacyNxPlugin`.',
    ]);
  });

  it('should hand a config an earlier conversion wrapped to the prompt', async () => {
    addExecutorProject('app1', LITERAL_CONFIG);
    await migrateComposePlugins(tree);
    const converted = tree.read('app1/webpack.config.js', 'utf-8');

    const result = await migrateComposePlugins(tree);

    expect(tree.read('app1/webpack.config.js', 'utf-8')).toEqual(converted);
    expect(result.nextSteps).toEqual([
      'Inline the `webpack.config.old.*` files that @nx/webpack:convert-config-to-webpack-plugin left behind in 1 project(s), then drop `useLegacyNxPlugin`.',
    ]);
  });

  describe('configs the converter cannot rewrite safely', () => {
    function addInferredProject(config: string) {
      addProjectConfiguration(tree, 'app1', { root: 'app1', targets: {} });
      tree.write('app1/webpack.config.js', config);
    }

    it.each([
      [
        'composePluginsSync',
        `const { composePluginsSync, withNx, withWeb } = require('@nx/webpack');
module.exports = composePluginsSync(withNx({ main: './src/main.ts' }), withWeb(), (config) => config);
`,
      ],
      [
        'withNx assigned to a variable',
        `const { composePlugins, withNx } = require('@nx/webpack');
const base = withNx({ main: './src/main.ts' });
module.exports = composePlugins(base, (config) => config);
`,
      ],
      [
        'ES module imports',
        `import { composePlugins, withNx } from '@nx/webpack';
export default composePlugins(withNx({ main: './src/main.ts' }), (config) => config);
`,
      ],
    ])(
      'should leave a config using %s untouched for the prompt',
      async (_, config) => {
        addInferredProject(config);

        const result = await migrateComposePlugins(tree);

        expect(tree.read('app1/webpack.config.js', 'utf-8')).toEqual(config);
        expect(tree.exists('app1/webpack.config.old.js')).toBe(false);
        expect(result.nextSteps).toEqual([
          'Migrate 1 project(s) off the removed webpack config helpers by hand: app1.',
        ]);
      }
    );

    it('should name the leftover helpers in the agent context', async () => {
      addInferredProject(`const { composePluginsSync, withNx, withWeb } = require('@nx/webpack');
module.exports = composePluginsSync(withNx({ main: './src/main.ts' }), withWeb(), (config) => config);
`);

      const result = await migrateComposePlugins(tree);

      expect(result.agentContext).toMatchInlineSnapshot(`
        [
          "@nx/webpack:convert-config-to-webpack-plugin could not convert these projects, so their configs are untouched and still call the removed helpers. Rewrite each one by hand:",
          "- app1 (app1): app1/webpack.config.js - Could not convert app1/webpack.config.js: composePluginsSync, withNx, withWeb would be left in the old config. Only \`require\`d helpers passed directly to \`composePlugins\` are supported.",
        ]
      `);
    });

    it('should leave Module Federation configs to the module federation migration', async () => {
      const config = `const { composePlugins, withNx } = require('@nx/webpack');
const { withModuleFederation } = require('@nx/module-federation/webpack');
module.exports = composePlugins(withNx({ main: './src/main.ts' }), withModuleFederation({ name: 'host' }), (config) => config);
`;
      addInferredProject(config);

      const result = await migrateComposePlugins(tree);

      expect(tree.read('app1/webpack.config.js', 'utf-8')).toEqual(config);
      expect(tree.exists('app1/webpack.config.old.js')).toBe(false);
      expect(result).toMatchInlineSnapshot(`
        {
          "agentContext": [
            "These projects compose Module Federation helpers, so their configs are untouched. The @nx/module-federation migration handles them; do not convert them here:",
            "- app1 (app1): app1/webpack.config.js",
          ],
          "nextSteps": [],
        }
      `);
    });

    it('should leave server-side rendering Module Federation configs untouched', async () => {
      const config = `const { composePlugins, withNx } = require('@nx/webpack');
const { withModuleFederationForSSR } = require('@nx/module-federation/webpack');
module.exports = composePlugins(withNx({ main: './src/main.ts' }), withModuleFederationForSSR({ name: 'host' }), (config) => config);
`;
      addInferredProject(config);

      await migrateComposePlugins(tree);

      expect(tree.read('app1/webpack.config.js', 'utf-8')).toEqual(config);
      expect(tree.exists('app1/webpack.config.old.js')).toBe(false);
    });
  });
});
