import { Tree, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addSvgrToNextConfig from './add-svgr-to-next-config';

describe('add-svgr-to-next-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not modify configs not using composePlugins and  withNx', async () => {
    // Add a Next.js project with next.config.js without svgr
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    const configContent = ` module.exports = {
// Custom config
};
`;

    tree.write('apps/my-app/next.config.js', configContent);

    await addSvgrToNextConfig(tree);

    const newContent = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(newContent).toEqual(configContent);
  });

  it('should not modify configs without svgr option', async () => {
    // Add a Next.js project with next.config.js without svgr
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    const configContent = `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    babelUpwardRootMode: true,
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`;

    tree.write('apps/my-app/next.config.js', configContent);

    await addSvgrToNextConfig(tree);

    const newContent = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(newContent).toEqual(configContent);
  });

  it('should remove nx.svgr option when it is false', async () => {
    // Add a Next.js project with next.config.js without svgr
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    const configContent = `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: false,
    babelUpwardRootMode: true,
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`;

    tree.write('apps/my-app/next.config.js', configContent);

    await addSvgrToNextConfig(tree);

    const newContent = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(newContent).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {
          babelUpwardRootMode: true,
        },
        reactStrictMode: true,
      };

      const plugins = [withNx];

      module.exports = composePlugins(...plugins)(nextConfig);
      "
    `);
  });

  it('should add SVGR as last function in composePlugins when nx.svgr is true', async () => {
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    tree.write(
      'apps/my-app/next.config.js',
      `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: true,
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`
    );

    await addSvgrToNextConfig(tree);

    const content = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {},
        reactStrictMode: true,
      };

      const plugins = [withNx];

      // Add SVGR webpack config function
      const withSvgr = (config) => {
        // Add SVGR support
        config.module.rules.push({
          test: /\\.svg$/,
          issuer: { not: /\\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
        return config;
      };

      module.exports = composePlugins(...plugins, withSvgr)(nextConfig);
      "
    `);
  });

  it('should handle nx.svgr with custom options', async () => {
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    tree.write(
      'apps/my-app/next.config.js',
      `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: {
      svgo: true,
      titleProp: false,
      ref: false,
    },
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`
    );

    await addSvgrToNextConfig(tree);

    const content = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {},
        reactStrictMode: true,
      };

      const plugins = [withNx];

      // Add SVGR webpack config function
      const withSvgr = (config) => {
        // Add SVGR support
        config.module.rules.push({
          test: /\\.svg$/,
          issuer: { not: /\\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: true,
                titleProp: false,
                ref: false,
              },
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
        return config;
      };

      module.exports = composePlugins(...plugins, withSvgr)(nextConfig);
      "
    `);
  });

  it('should handle spread operator pattern in composePlugins', async () => {
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    tree.write(
      'apps/my-app/next.config.js',
      `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: true,
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`
    );

    await addSvgrToNextConfig(tree);

    const content = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {},
        reactStrictMode: true,
      };

      const plugins = [withNx];

      // Add SVGR webpack config function
      const withSvgr = (config) => {
        // Add SVGR support
        config.module.rules.push({
          test: /\\.svg$/,
          issuer: { not: /\\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
        return config;
      };

      module.exports = composePlugins(...plugins, withSvgr)(nextConfig);
      "
    `);
  });

  it('should handle multiple Next.js projects', async () => {
    // First app with svgr: true
    tree.write(
      'apps/app1/project.json',
      JSON.stringify({
        root: 'apps/app1',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    tree.write(
      'apps/app1/next.config.js',
      `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: true,
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`
    );

    // Second app without svgr
    tree.write(
      'apps/app2/project.json',
      JSON.stringify({
        root: 'apps/app2',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    const configContent2 = `const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    babelUpwardRootMode: true,
  },
  reactStrictMode: true,
};

const plugins = [withNx];

module.exports = composePlugins(...plugins)(nextConfig);
`;
    tree.write('apps/app2/next.config.js', configContent2);

    await addSvgrToNextConfig(tree);

    const content1 = tree.read('apps/app1/next.config.js', 'utf-8');
    const content2 = tree.read('apps/app2/next.config.js', 'utf-8');

    expect(content1).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {},
        reactStrictMode: true,
      };

      const plugins = [withNx];

      // Add SVGR webpack config function
      const withSvgr = (config) => {
        // Add SVGR support
        config.module.rules.push({
          test: /\\.svg$/,
          issuer: { not: /\\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
        return config;
      };

      module.exports = composePlugins(...plugins, withSvgr)(nextConfig);
      "
    `);
    expect(content2).toEqual(configContent2);
  });

  it('should preserve other nx options', async () => {
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    tree.write(
      'apps/my-app/next.config.js',
      `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: true,
    babelUpwardRootMode: true,
    fileReplacements: [],
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`
    );

    await addSvgrToNextConfig(tree);

    const content = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {
          babelUpwardRootMode: true,
          fileReplacements: [],
        },
        reactStrictMode: true,
      };

      const plugins = [withNx];

      // Add SVGR webpack config function
      const withSvgr = (config) => {
        // Add SVGR support
        config.module.rules.push({
          test: /\\.svg$/,
          issuer: { not: /\\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
        return config;
      };

      module.exports = composePlugins(...plugins, withSvgr)(nextConfig);
      "
    `);
  });

  it('should handle empty nx object after removing svgr', async () => {
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        root: 'apps/my-app',
        targets: {
          build: {
            executor: '@nx/next:build',
            options: {},
          },
        },
      })
    );

    tree.write(
      'apps/my-app/next.config.js',
      `
const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {
  nx: {
    svgr: true
  },
  reactStrictMode: true,
};

const plugins = [
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
`
    );

    await addSvgrToNextConfig(tree);

    const content = tree.read('apps/my-app/next.config.js', 'utf-8');
    expect(content).toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/next');

      const nextConfig = {
        nx: {},
        reactStrictMode: true,
      };

      const plugins = [withNx];

      // Add SVGR webpack config function
      const withSvgr = (config) => {
        // Add SVGR support
        config.module.rules.push({
          test: /\\.svg$/,
          issuer: { not: /\\.(css|scss|sass)$/ },
          resourceQuery: {
            not: [
              /__next_metadata__/,
              /__next_metadata_route__/,
              /__next_metadata_image_meta__/,
            ],
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash].[ext]',
              },
            },
          ],
        });
        return config;
      };

      module.exports = composePlugins(...plugins, withSvgr)(nextConfig);
      "
    `);
  });
});
