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

  it('should route a project without the executor to the prompt', async () => {
    addProjectConfiguration(tree, 'app1', { root: 'app1', targets: {} });
    tree.write('app1/webpack.config.js', LITERAL_CONFIG);

    const result = await migrateComposePlugins(tree);

    expect(tree.read('app1/webpack.config.js', 'utf-8')).toEqual(
      LITERAL_CONFIG
    );
    expect(result.agentContext.join('\n')).toContain(
      'does not use the `@nx/webpack:webpack` executor'
    );
  });
});
