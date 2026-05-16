import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addSvgrToRspackConfig from './add-svgr-to-rspack-config';

describe('add-svgr-to-rspack-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function writeProject(rspackConfigPath: string) {
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/rspack:rspack',
            options: {
              rspackConfig: rspackConfigPath,
            },
          },
        },
      })
    );
  }

  describe('withReact configurations', () => {
    it('should not modify configs without svgr option', async () => {
      writeProject('apps/my-app/rspack.config.js');

      const configContent = `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact(),
  (config) => {
    return config;
  }
);
`;

      tree.write('apps/my-app/rspack.config.js', configContent);

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toEqual(configContent);
    });

    it('should add withSvgr function and update config when svgr is true', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return function configure(config) {
            // Remove existing SVG loader if present
            const svgLoaderIdx = config.module.rules.findIndex(
              (rule) =>
                typeof rule === 'object' &&
                typeof rule.test !== 'undefined' &&
                rule.test.toString().includes('svg'),
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            config.module.rules.push(
              {
                test: /\\.svg$/i,
                type: 'asset',
                resourceQuery: /url/, // *.svg?url
              },
              {
                test: /\\.svg$/i,
                issuer: /\\.[jt]sx?$/,
                resourceQuery: { not: [/url/] },
                use: [{ loader: '@svgr/webpack', options }],
              },
            );

            return config;
          };
        }

        module.exports = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });
        "
      `);
    });

    it('should handle svgr with custom options', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({
    svgr: {
      svgo: true,
      titleProp: false,
      ref: false,
    },
  }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return function configure(config) {
            // Remove existing SVG loader if present
            const svgLoaderIdx = config.module.rules.findIndex(
              (rule) =>
                typeof rule === 'object' &&
                typeof rule.test !== 'undefined' &&
                rule.test.toString().includes('svg'),
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            config.module.rules.push(
              {
                test: /\\.svg$/i,
                type: 'asset',
                resourceQuery: /url/, // *.svg?url
              },
              {
                test: /\\.svg$/i,
                issuer: /\\.[jt]sx?$/,
                resourceQuery: { not: [/url/] },
                use: [{ loader: '@svgr/webpack', options }],
              },
            );

            return config;
          };
        }

        module.exports = composePlugins(
          withNx(),
          withReact(),
          withSvgr({
            svgo: true,
            titleProp: false,
            ref: false,
          }),
          (config) => {
            return config;
          },
        );
        "
      `);
    });

    it('should remove svgr option when svgr is set to false', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({
    svgr: false,
  }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');

        module.exports = composePlugins(withNx(), withReact(), (config) => {
          return config;
        });
        "
      `);
    });

    it('should preserve existing imports', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');
const someOtherLib = require('some-lib');

// Some comment here

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');
        const someOtherLib = require('some-lib');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return function configure(config) {
            // Remove existing SVG loader if present
            const svgLoaderIdx = config.module.rules.findIndex(
              (rule) =>
                typeof rule === 'object' &&
                typeof rule.test !== 'undefined' &&
                rule.test.toString().includes('svg'),
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            config.module.rules.push(
              {
                test: /\\.svg$/i,
                type: 'asset',
                resourceQuery: /url/, // *.svg?url
              },
              {
                test: /\\.svg$/i,
                issuer: /\\.[jt]sx?$/,
                resourceQuery: { not: [/url/] },
                use: [{ loader: '@svgr/webpack', options }],
              },
            );

            return config;
          };
        }

        // Some comment here

        module.exports = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });
        "
      `);
    });

    it('should handle module.exports with variable reference', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

const config = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);

module.exports = config;
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return function configure(config) {
            // Remove existing SVG loader if present
            const svgLoaderIdx = config.module.rules.findIndex(
              (rule) =>
                typeof rule === 'object' &&
                typeof rule.test !== 'undefined' &&
                rule.test.toString().includes('svg'),
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            config.module.rules.push(
              {
                test: /\\.svg$/i,
                type: 'asset',
                resourceQuery: /url/, // *.svg?url
              },
              {
                test: /\\.svg$/i,
                issuer: /\\.[jt]sx?$/,
                resourceQuery: { not: [/url/] },
                use: [{ loader: '@svgr/webpack', options }],
              },
            );

            return config;
          };
        }

        const config = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });

        module.exports = config;
        "
      `);
    });

    it('should handle imports and export default (ESM)', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `import { composePlugins, withNx, withReact } from '@nx/rspack';
import someOtherLib from 'some-lib';

export default composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import { composePlugins, withNx, withReact } from '@nx/rspack';
        import someOtherLib from 'some-lib';

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return function configure(config) {
            // Remove existing SVG loader if present
            const svgLoaderIdx = config.module.rules.findIndex(
              (rule) =>
                typeof rule === 'object' &&
                typeof rule.test !== 'undefined' &&
                rule.test.toString().includes('svg'),
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            config.module.rules.push(
              {
                test: /\\.svg$/i,
                type: 'asset',
                resourceQuery: /url/, // *.svg?url
              },
              {
                test: /\\.svg$/i,
                issuer: /\\.[jt]sx?$/,
                resourceQuery: { not: [/url/] },
                use: [{ loader: '@svgr/webpack', options }],
              },
            );

            return config;
          };
        }

        export default composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });
        "
      `);
    });

    it('should preserve other withReact options when removing svgr: false', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({
    svgr: false,
    stylePreprocessorOptions: { sassOptions: { quietDeps: true } },
  }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');

        module.exports = composePlugins(
          withNx(),
          withReact({
            stylePreprocessorOptions: { sassOptions: { quietDeps: true } },
          }),
          (config) => {
            return config;
          },
        );
        "
      `);
    });

    it('should preserve other withReact options when migrating svgr: true', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({
    svgr: true,
    stylePreprocessorOptions: { sassOptions: { quietDeps: true } },
  }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx, withReact } = require('@nx/rspack');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return function configure(config) {
            // Remove existing SVG loader if present
            const svgLoaderIdx = config.module.rules.findIndex(
              (rule) =>
                typeof rule === 'object' &&
                typeof rule.test !== 'undefined' &&
                rule.test.toString().includes('svg'),
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            config.module.rules.push(
              {
                test: /\\.svg$/i,
                type: 'asset',
                resourceQuery: /url/, // *.svg?url
              },
              {
                test: /\\.svg$/i,
                issuer: /\\.[jt]sx?$/,
                resourceQuery: { not: [/url/] },
                use: [{ loader: '@svgr/webpack', options }],
              },
            );

            return config;
          };
        }

        module.exports = composePlugins(
          withNx(),
          withReact({
            stylePreprocessorOptions: { sassOptions: { quietDeps: true } },
          }),
          withSvgr(),
          (config) => {
            return config;
          },
        );
        "
      `);
    });
  });

  describe('NxReactRspackPlugin configurations', () => {
    it('should not modify configs without svgr option', async () => {
      writeProject('apps/my-app/rspack.config.js');

      const configContent = `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

module.exports = {
  plugins: [
    new NxAppRspackPlugin(),
    new NxReactRspackPlugin({
      // svgr: false
    }),
  ],
};
`;

      tree.write('apps/my-app/rspack.config.js', configContent);

      await addSvgrToRspackConfig(tree);

      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toEqual(configContent);
    });

    it('should handle svgr: true', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `
const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

module.exports = {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxAppRspackPlugin({
      tsConfig: './tsconfig.app.json',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactRspackPlugin({
      svgr: true
    }),
  ],
};
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return (config) => {
            config.plugins.push({
              apply: (compiler) => {
                // Remove ALL existing SVG loaders
                compiler.options.module.rules = compiler.options.module.rules.filter(
                  (rule) =>
                    !(
                      rule &&
                      typeof rule === 'object' &&
                      rule.test &&
                      rule.test.toString().includes('svg')
                    ),
                );

                compiler.options.module.rules.push(
                  {
                    test: /\\.svg$/i,
                    type: 'asset',
                    resourceQuery: /url/,
                  },
                  {
                    test: /\\.svg$/i,
                    issuer: /\\.[jt]sx?$/,
                    resourceQuery: { not: [/url/] },
                    use: [{ loader: '@svgr/webpack', options }],
                  },
                );
              },
            });
            return config;
          };
        }

        module.exports = withSvgr()({
          output: {
            path: join(__dirname, '../dist/apps/my-app'),
          },
          plugins: [
            new NxAppRspackPlugin({
              tsConfig: './tsconfig.app.json',
              main: './src/main.tsx',
              index: './src/index.html',
            }),
            new NxReactRspackPlugin(),
          ],
        });
        "
      `);
    });

    it('should handle svgr options object', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

module.exports = {
  plugins: [
    new NxAppRspackPlugin(),
    new NxReactRspackPlugin({
      svgr: {
        svgo: true,
        titleProp: false,
        ref: false,
      },
    }),
  ],
};
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return (config) => {
            config.plugins.push({
              apply: (compiler) => {
                // Remove ALL existing SVG loaders
                compiler.options.module.rules = compiler.options.module.rules.filter(
                  (rule) =>
                    !(
                      rule &&
                      typeof rule === 'object' &&
                      rule.test &&
                      rule.test.toString().includes('svg')
                    ),
                );

                compiler.options.module.rules.push(
                  {
                    test: /\\.svg$/i,
                    type: 'asset',
                    resourceQuery: /url/,
                  },
                  {
                    test: /\\.svg$/i,
                    issuer: /\\.[jt]sx?$/,
                    resourceQuery: { not: [/url/] },
                    use: [{ loader: '@svgr/webpack', options }],
                  },
                );
              },
            });
            return config;
          };
        }

        module.exports = withSvgr({
          svgo: true,
          titleProp: false,
          ref: false,
        })({
          plugins: [new NxAppRspackPlugin(), new NxReactRspackPlugin()],
        });
        "
      `);
    });

    it('should handle module.exports with variable reference', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

const config = {
  plugins: [
    new NxAppRspackPlugin(),
    new NxReactRspackPlugin({
      svgr: true,
    }),
  ],
};

module.exports = config;
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return (config) => {
            config.plugins.push({
              apply: (compiler) => {
                // Remove ALL existing SVG loaders
                compiler.options.module.rules = compiler.options.module.rules.filter(
                  (rule) =>
                    !(
                      rule &&
                      typeof rule === 'object' &&
                      rule.test &&
                      rule.test.toString().includes('svg')
                    ),
                );

                compiler.options.module.rules.push(
                  {
                    test: /\\.svg$/i,
                    type: 'asset',
                    resourceQuery: /url/,
                  },
                  {
                    test: /\\.svg$/i,
                    issuer: /\\.[jt]sx?$/,
                    resourceQuery: { not: [/url/] },
                    use: [{ loader: '@svgr/webpack', options }],
                  },
                );
              },
            });
            return config;
          };
        }

        const config = {
          plugins: [new NxAppRspackPlugin(), new NxReactRspackPlugin()],
        };

        module.exports = withSvgr()(config);
        "
      `);
    });

    it('should handle export default', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';

export default {
  plugins: [
    new NxAppRspackPlugin(),
    new NxReactRspackPlugin({
      svgr: true,
    }),
  ],
};
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
        import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';

        // SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
        function withSvgr(svgrOptions = {}) {
          const defaultOptions = {
            svgo: false,
            titleProp: true,
            ref: true,
          };

          const options = { ...defaultOptions, ...svgrOptions };

          return (config) => {
            config.plugins.push({
              apply: (compiler) => {
                // Remove ALL existing SVG loaders
                compiler.options.module.rules = compiler.options.module.rules.filter(
                  (rule) =>
                    !(
                      rule &&
                      typeof rule === 'object' &&
                      rule.test &&
                      rule.test.toString().includes('svg')
                    ),
                );

                compiler.options.module.rules.push(
                  {
                    test: /\\.svg$/i,
                    type: 'asset',
                    resourceQuery: /url/,
                  },
                  {
                    test: /\\.svg$/i,
                    issuer: /\\.[jt]sx?$/,
                    resourceQuery: { not: [/url/] },
                    use: [{ loader: '@svgr/webpack', options }],
                  },
                );
              },
            });
            return config;
          };
        }

        export default withSvgr()({
          plugins: [new NxAppRspackPlugin(), new NxReactRspackPlugin()],
        });
        "
      `);
    });

    it('should remove svgr: false from plugin options', async () => {
      writeProject('apps/my-app/rspack.config.js');

      tree.write(
        'apps/my-app/rspack.config.js',
        `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

module.exports = {
  plugins: [
    new NxAppRspackPlugin(),
    new NxReactRspackPlugin({
      svgr: false,
    }),
  ],
};
`
      );

      await addSvgrToRspackConfig(tree);
      const content = tree.read('apps/my-app/rspack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');

        module.exports = {
          plugins: [new NxAppRspackPlugin(), new NxReactRspackPlugin()],
        };
        "
      `);
    });
  });

  describe('multiple configs', () => {
    it('should handle multiple rspack configs in workspace', async () => {
      tree.write(
        'apps/app-1/project.json',
        JSON.stringify({
          root: 'apps/app-1',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: { rspackConfig: 'apps/app-1/rspack.config.js' },
            },
          },
        })
      );
      tree.write(
        'apps/app-2/project.json',
        JSON.stringify({
          root: 'apps/app-2',
          targets: {
            build: {
              executor: '@nx/rspack:rspack',
              options: { rspackConfig: 'apps/app-2/rspack.config.js' },
            },
          },
        })
      );

      tree.write(
        'apps/app-1/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);
`
      );

      tree.write(
        'apps/app-2/rspack.config.js',
        `const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact(),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToRspackConfig(tree);

      const app1Content = tree.read('apps/app-1/rspack.config.js', 'utf-8');
      expect(app1Content).toContain('function withSvgr');
      expect(app1Content).toContain('withSvgr()');

      const app2Content = tree.read('apps/app-2/rspack.config.js', 'utf-8');
      expect(app2Content).not.toContain('function withSvgr');
    });
  });
});
