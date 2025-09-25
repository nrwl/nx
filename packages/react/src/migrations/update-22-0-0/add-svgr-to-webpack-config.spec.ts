import { Tree, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addSvgrToWebpackConfig from './add-svgr-to-webpack-config';

describe('add-svgr-to-webpack-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not modify configs using NxReactWebpackPlugin without svgr option', async () => {
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

  it('should not modify configs using withReact without svgr option', async () => {
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
const { composePlugins, withNx } = require('@nx/webpack');
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
    const newContent = tree.read('apps/my-app/webpack.config.js', 'utf-8');

    expect(newContent).toEqual(configContent);
  });

  it('should add withSvgr function and update config when svgr is true in withReact', async () => {
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
const { composePlugins, withNx } = require('@nx/webpack');
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

  it('should handle svgr with custom options in withReact', async () => {
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
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(
  withNx(),
  withReact({
    svgr: {
      svgo: true,
      titleProp: false,
      ref: false
    }
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

  it('should handle svgr in NxReactWebpackPlugin', async () => {
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

    // Should add withSvgr function
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

  it('should remove svgr option from config when svgr is set to false', async () => {
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
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: false }),
  (config) => {
    return config;
  }
);
`;
    tree.write('apps/my-app/webpack.config.js', configContent);

    await addSvgrToWebpackConfig(tree);
    const newContent = tree.read('apps/my-app/webpack.config.js', 'utf-8');

    expect(newContent).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/webpack');
      const { withReact } = require('@nx/react');

      module.exports = composePlugins(withNx(), withReact(), (config) => {
        return config;
      });
      "
    `);
  });

  it('should handle multiple webpack configs in workspace', async () => {
    // First app with svgr: true
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
      `
const { composePlugins, withNx } = require('@nx/webpack');
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

    // Second app without svgr
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

    const configContent2 = `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(withNx(), withReact(), (config) => {
  return config;
});
`;

    tree.write('apps/app2/webpack.config.js', configContent2);

    await addSvgrToWebpackConfig(tree);

    const content1 = tree.read('apps/app1/webpack.config.js', 'utf-8');
    const content2 = tree.read('apps/app2/webpack.config.js', 'utf-8');
    expect(content1).toMatchInlineSnapshot(`
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
    // This one is unchanged since it doesn't use svgr
    expect(content2).toEqual(configContent2);
  });

  it('should handle export default with NxReactWebpackPlugin', async () => {
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

  it('should handle imports and export default (ESM) instead of require/module.exports', async () => {
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

  it('should not modify NxReactWebpackPlugin with svgr: false', async () => {
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

  it('should handle NxReactWebpackPlugin with svgr options object', async () => {
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
});
