import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import webpackConfigSetup from './webpack-config-setup';

describe('15.6.3 migration (setup webpack.config file for React apps)', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should create webpack.config.js for React projects only', async () => {
    addProjectConfiguration(tree, 'react1', {
      root: 'apps/react1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/react1/src/main.tsx',
            webpackConfig: '@nrwl/react/plugins/webpack',
          },
        },
      },
    });
    addProjectConfiguration(tree, 'react2', {
      root: 'apps/react2',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/react2/src/main.tsx',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'react3', {
      root: 'apps/react3',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: '@nrwl/react/plugins/webpack',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'react4', {
      root: 'apps/react4',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/react4/src/main.tsx',
            webpackConfig: 'apps/react4/webpack.something.ts',
          },
        },
      },
    });
    tree.write('apps/react4/webpack.something.ts', 'some content');

    await webpackConfigSetup(tree);

    expect(
      tree.read('apps/react1/webpack.config.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/react2/webpack.config.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('apps/react3/webpack.config.js', 'utf-8')
    ).toMatchSnapshot();

    expect(
      tree.read('apps/react4/webpack.something.ts', 'utf-8')
    ).toMatchSnapshot();

    expect(
      tree.read('apps/react4/webpack.something.old.ts', 'utf-8')
    ).toMatchInlineSnapshot(`"some content"`);
  });

  it('should ignore non-react projects or isolatedConfig', async () => {
    addProjectConfiguration(tree, 'app4', {
      root: 'apps/app4',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: 'some/random/path/webpack.something.ts',
          },
        },
      },
    });
    tree.write('some/random/path/webpack.something.ts', 'some content');

    addProjectConfiguration(tree, 'app5', {
      root: 'apps/app5',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            isolatedConfig: true,
          },
        },
      },
    });

    addProjectConfiguration(tree, 'app6', {
      root: 'apps/app6',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/app6/src/main.ts',
          },
        },
      },
    });

    await webpackConfigSetup(tree);

    expect(
      tree.read('some/random/path/webpack.something.ts', 'utf-8')
    ).toMatchInlineSnapshot(`"some content"`);
    expect(
      tree.exists('some/random/path/webpack.something.old.ts')
    ).toBeFalsy();
    expect(tree.exists('apps/app5/webpack.config.js')).toBeFalsy();
    expect(tree.exists('apps/app6/webpack.config.js')).toBeFalsy();
  });

  it('should update the project configuration - executor options', async () => {
    addProjectConfiguration(tree, 'react1', {
      root: 'apps/react1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/react1/src/main.tsx',
            webpackConfig: '@nrwl/react/plugins/webpack',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'react2', {
      root: 'apps/react2',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/react2/src/main.tsx',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'react3', {
      root: 'apps/react3',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: '@nrwl/react/plugins/webpack',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'react4', {
      root: 'apps/react4',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/react4/src/main.tsx',
            webpackConfig: 'apps/react4/webpack.something.ts',
          },
        },
      },
    });
    tree.write('apps/react4/webpack.something.ts', 'some content');

    await webpackConfigSetup(tree);

    expect(
      readProjectConfiguration(tree, 'react1').targets.build.options
        .webpackConfig
    ).toBe('apps/react1/webpack.config.js');
    expect(
      readProjectConfiguration(tree, 'react2').targets.custom.options
        .webpackConfig
    ).toBe('apps/react2/webpack.config.js');

    expect(
      readProjectConfiguration(tree, 'react3').targets.custom.options
        .webpackConfig
    ).toBe('apps/react3/webpack.config.js');

    expect(
      readProjectConfiguration(tree, 'react4').targets.custom.options
        .webpackConfig
    ).toBe('apps/react4/webpack.something.ts');

    expect(
      readProjectConfiguration(tree, 'react1').targets.build.options
        .isolatedConfig
    ).toBeTruthy();
    expect(
      readProjectConfiguration(tree, 'react2').targets.custom.options
        .isolatedConfig
    ).toBeTruthy();

    expect(
      readProjectConfiguration(tree, 'react3').targets.custom.options
        .isolatedConfig
    ).toBeTruthy();

    expect(
      readProjectConfiguration(tree, 'react4').targets.custom.options
        .isolatedConfig
    ).toBeTruthy();
  });

  it('should migrate configurations (dev, prod, etc.) with webpackConfig but ignore ones without it', async () => {
    addProjectConfiguration(tree, 'reactapp', {
      root: 'apps/reactapp',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/reactapp/src/main.tsx',
            webpackConfig: 'apps/reactapp/webpack.config.js',
          },
          configurations: {
            foo: {},
            bar: {
              webpackConfig: 'apps/reactapp/webpack.config.bar.js',
            },
          },
        },
      },
    });
    tree.write('apps/reactapp/webpack.config.js', 'default');
    tree.write('apps/reactapp/webpack.config.bar.js', 'bar');

    addProjectConfiguration(tree, 'alreadymigrated', {
      root: 'apps/alreadymigrated',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            isolatedConfig: true,
            main: 'apps/alreadymigrated/src/main.tsx',
            webpackConfig: 'apps/alreadymigrated/webpack.config.js',
          },
          configurations: {
            foo: {},
            bar: {
              webpackConfig: 'apps/alreadymigrated/webpack.config.bar.js',
            },
          },
        },
      },
    });
    tree.write('apps/alreadymigrated/webpack.config.js', 'default');
    tree.write('apps/alreadymigrated/webpack.config.bar.js', 'bar');

    await webpackConfigSetup(tree);

    expect(tree.read('apps/reactapp/webpack.config.old.js', 'utf-8')).toContain(
      'default'
    );
    expect(
      tree.read('apps/reactapp/webpack.config.bar.old.js', 'utf-8')
    ).toContain('bar');

    expect(
      tree.read('apps/alreadymigrated/webpack.config.js', 'utf-8')
    ).toContain('default');
    expect(
      tree.read('apps/alreadymigrated/webpack.config.bar.js', 'utf-8')
    ).toContain('bar');
    expect(
      tree.exists('apps/alreadymigrated/webpack.config.old.js')
    ).toBeFalsy();
    expect(
      tree.exists('apps/alreadymigrated/webpack.config.bar.old.js')
    ).toBeFalsy();
  });
});
