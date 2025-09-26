import { Tree, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addSvgrToWebpackConfig from './add-svgr-to-webpack-config';

describe('add-svgr-to-webpack-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('withReact configurations', () => {
    it('should not modify configs without svgr option', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      const configContent = `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(
  withNx(),
  withReact(),
  (config) => {
    return config;
  }
);
`;

      tree.write('apps/my-app/webpack.config.js', configContent);

      await addSvgrToWebpackConfig(tree);

      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toEqual(configContent);
    });

    it('should add withSvgr function and update config when svgr is true', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);
`
      );

      await addSvgrToWebpackConfig(tree);

      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

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
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

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

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

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
          }
        );
        "
      `);
    });

    it('should remove svgr option when svgr is set to false', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

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

      await addSvgrToWebpackConfig(tree);

      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        module.exports = composePlugins(withNx(), withReact(), (config) => {
          return config;
        });
        "
      `);
    });

    it('should preserve existing imports', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
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

      await addSvgrToWebpackConfig(tree);

      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');
        const someOtherLib = require('some-lib');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

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
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

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

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

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

    it('should handle export default with variable reference', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';

const config = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);

export default config;
`
      );

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import { composePlugins, withNx } from '@nx/webpack';
        import { withReact } from '@nx/react';

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        const config = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });

        export default config;
        "
      `);
    });

    it('should handle imports and export default (ESM)', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
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

      await addSvgrToWebpackConfig(tree);

      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import { composePlugins, withNx } from '@nx/webpack';
        import { withReact } from '@nx/react';
        import someOtherLib from 'some-lib';

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        export default composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });
        "
      `);
    });
  });

  describe('NxReactWebpackPlugin configurations', () => {
    it('should not modify configs without svgr option', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      const configContent = `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');

module.exports = {
  plugins: [
    new NxAppWebpackPlugin(),
    new NxReactWebpackPlugin({
      // svgr: false
    }),
  ],
};
`;

      tree.write('apps/my-app/webpack.config.js', configContent);

      await addSvgrToWebpackConfig(tree);

      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toEqual(configContent);
    });

    it('should handle svgr: true', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `
const { NxWebpackPlugin } = require('@nx/webpack');
const { NxReactWebpackPlugin } = require('@nx/react');

module.exports = {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactWebpackPlugin({
      svgr: true
    }),
  ],
};
`
      );

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { NxWebpackPlugin } = require('@nx/webpack');
        const { NxReactWebpackPlugin } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        module.exports = withSvgr()({
          output: {
            path: join(__dirname, '../dist/apps/my-app'),
          },
          plugins: [
            new NxWebpackPlugin({
              tsConfig: './tsconfig.app.json',
              compiler: 'babel',
              main: './src/main.tsx',
              index: './src/index.html',
            }),
            new NxReactWebpackPlugin(),
          ],
        });
        "
      `);
    });

    it('should not modify when svgr: false', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      const configContent = `
const { NxWebpackPlugin } = require('@nx/webpack');
const { NxReactWebpackPlugin } = require('@nx/react');

module.exports = {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactWebpackPlugin({
      svgr: false
    }),
  ],
};
`;

      tree.write('apps/my-app/webpack.config.js', configContent);

      await addSvgrToWebpackConfig(tree);
      const newContent = tree.read('apps/my-app/webpack.config.js', 'utf-8');

      expect(newContent).toEqual(configContent);
    });

    it('should handle svgr options object', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `
const { NxWebpackPlugin } = require('@nx/webpack');
const { NxReactWebpackPlugin } = require('@nx/react');

module.exports = {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactWebpackPlugin({
      svgr: {
        svgo: true,
        titleProp: false,
        ref: false,
      }
    }),
  ],
};
`
      );

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');

      expect(content).toMatchInlineSnapshot(`
        "const { NxWebpackPlugin } = require('@nx/webpack');
        const { NxReactWebpackPlugin } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        module.exports = withSvgr({
          svgo: true,
          titleProp: false,
          ref: false,
        })({
          output: {
            path: join(__dirname, '../dist/apps/my-app'),
          },
          plugins: [
            new NxWebpackPlugin({
              tsConfig: './tsconfig.app.json',
              compiler: 'babel',
              main: './src/main.tsx',
              index: './src/index.html',
            }),
            new NxReactWebpackPlugin(),
          ],
        });
        "
      `);
    });

    it('should handle module.exports with variable reference', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `const { NxWebpackPlugin } = require('@nx/webpack');
const { NxReactWebpackPlugin } = require('@nx/react');

const webpackConfig = {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactWebpackPlugin({
      svgr: true
    }),
  ],
};

module.exports = webpackConfig;
`
      );

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "const { NxWebpackPlugin } = require('@nx/webpack');
        const { NxReactWebpackPlugin } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        const webpackConfig = {
          output: {
            path: join(__dirname, '../dist/apps/my-app'),
          },
          plugins: [
            new NxWebpackPlugin({
              tsConfig: './tsconfig.app.json',
              compiler: 'babel',
              main: './src/main.tsx',
              index: './src/index.html',
            }),
            new NxReactWebpackPlugin(),
          ],
        };

        module.exports = withSvgr()(webpackConfig);
        "
      `);
    });

    it('should handle export default with variable reference', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `import { NxWebpackPlugin } from '@nx/webpack';
import { NxReactWebpackPlugin } from '@nx/react';

const webpackConfig = {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactWebpackPlugin({
      svgr: true
    }),
  ],
};

export default webpackConfig;
`
      );

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "import { NxWebpackPlugin } from '@nx/webpack';
        import { NxReactWebpackPlugin } from '@nx/react';

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        const webpackConfig = {
          output: {
            path: join(__dirname, '../dist/apps/my-app'),
          },
          plugins: [
            new NxWebpackPlugin({
              tsConfig: './tsconfig.app.json',
              compiler: 'babel',
              main: './src/main.tsx',
              index: './src/index.html',
            }),
            new NxReactWebpackPlugin(),
          ],
        };

        export default withSvgr()(webpackConfig);
        "
      `);
    });

    it('should handle export default', async () => {
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          root: 'apps/my-app',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/my-app/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/my-app/webpack.config.js',
        `
import { NxWebpackPlugin } from '@nx/webpack';
import { NxReactWebpackPlugin } from '@nx/react';

export default {
  output: {
    path: join(__dirname, '../dist/apps/my-app'),
  },
  plugins: [
    new NxWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
    }),
    new NxReactWebpackPlugin({
      svgr: true
    }),
  ],
};
`
      );

      await addSvgrToWebpackConfig(tree);
      const content = tree.read('apps/my-app/webpack.config.js', 'utf-8');

      expect(content).toMatchInlineSnapshot(`
        "import { NxWebpackPlugin } from '@nx/webpack';
        import { NxReactWebpackPlugin } from '@nx/react';

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        export default withSvgr()({
          output: {
            path: join(__dirname, '../dist/apps/my-app'),
          },
          plugins: [
            new NxWebpackPlugin({
              tsConfig: './tsconfig.app.json',
              compiler: 'babel',
              main: './src/main.tsx',
              index: './src/index.html',
            }),
            new NxReactWebpackPlugin(),
          ],
        });
        "
      `);
    });
  });

  describe('multiple configs', () => {
    it('should handle multiple webpack configs in workspace', async () => {
      // First app with withReact and svgr: true
      tree.write(
        'apps/app1/project.json',
        JSON.stringify({
          root: 'apps/app1',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/app1/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/app1/webpack.config.js',
        `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: true }),
  (config) => {
    return config;
  }
);
`
      );

      // Second app with NxReactWebpackPlugin and custom svgr options
      tree.write(
        'apps/app2/project.json',
        JSON.stringify({
          root: 'apps/app2',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/app2/webpack.config.js',
              },
            },
          },
        })
      );

      tree.write(
        'apps/app2/webpack.config.js',
        `const { NxWebpackPlugin } = require('@nx/webpack');
const { NxReactWebpackPlugin } = require('@nx/react');

module.exports = {
  plugins: [
    new NxWebpackPlugin(),
    new NxReactWebpackPlugin({
      svgr: { svgo: false }
    }),
  ],
};
`
      );

      // Third app without svgr
      tree.write(
        'apps/app3/project.json',
        JSON.stringify({
          root: 'apps/app3',
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                webpackConfig: 'apps/app3/webpack.config.js',
              },
            },
          },
        })
      );

      const app3Config = `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(withNx(), withReact(), (config) => config);
`;
      tree.write('apps/app3/webpack.config.js', app3Config);

      await addSvgrToWebpackConfig(tree);

      // Check app1 was modified
      const app1Content = tree.read('apps/app1/webpack.config.js', 'utf-8');
      expect(app1Content).toMatchInlineSnapshot(`
        "const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        module.exports = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
          return config;
        });
        "
      `);

      // Check app2 was modified
      const app2Content = tree.read('apps/app2/webpack.config.js', 'utf-8');
      expect(app2Content).toMatchInlineSnapshot(`
        "const { NxWebpackPlugin } = require('@nx/webpack');
        const { NxReactWebpackPlugin } = require('@nx/react');

        // SVGR support function (migrated from svgr option in withReact/NxReactWebpackPlugin)
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
                rule.test.toString().includes('svg')
            );

            if (svgLoaderIdx !== -1) {
              config.module.rules.splice(svgLoaderIdx, 1);
            }

            // Add SVGR loader
            config.module.rules.push({
              test: /\\.svg$/,
              issuer: /\\.(js|ts|md)x?$/,
              use: [
                {
                  loader: require.resolve('@svgr/webpack'),
                  options,
                },
                {
                  loader: require.resolve('file-loader'),
                  options: {
                    name: '[name].[hash].[ext]',
                  },
                },
              ],
            });

            return config;
          };
        }

        module.exports = withSvgr({
          svgo: false,
        })({
          plugins: [new NxWebpackPlugin(), new NxReactWebpackPlugin()],
        });
        "
      `);

      // Check app3 was NOT modified
      const app3Content = tree.read('apps/app3/webpack.config.js', 'utf-8');
      expect(app3Content).toEqual(app3Config);
    });
  });
});
