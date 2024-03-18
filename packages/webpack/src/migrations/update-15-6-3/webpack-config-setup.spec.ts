import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import webpackConfigSetup from './webpack-config-setup';

describe('15.6.3 migration (setup webpack.config file)', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should create webpack.config.js for projects that do not have one', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {},
        },
      },
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {},
        },
      },
    });

    await webpackConfigSetup(tree);

    expect(tree.read('apps/app1/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('apps/app2/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should rename existing webpack.config file and create new one that requires it', async () => {
    addProjectConfiguration(tree, 'app3', {
      root: 'apps/app3',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: 'apps/app3/webpack.config.js',
          },
        },
      },
    });
    tree.write('apps/app3/webpack.config.js', 'some content');

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

    await webpackConfigSetup(tree);

    expect(tree.read('apps/app3/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('apps/app3/webpack.config.old.js', 'utf-8')
    ).toMatchInlineSnapshot(`"some content"`);

    expect(
      tree.read('some/random/path/webpack.something.ts', 'utf-8')
    ).toMatchSnapshot();

    expect(
      tree.read('some/random/path/webpack.something.old.ts', 'utf-8')
    ).toMatchInlineSnapshot(`"some content"`);
  });

  it('should update the project configuration - executor options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {},
        },
      },
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {},
        },
      },
    });

    addProjectConfiguration(tree, 'app3', {
      root: 'apps/app3',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: 'apps/app3/webpack.config.js',
          },
        },
      },
    });

    tree.write('apps/app3/webpack.config.js', 'some content');

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

    await webpackConfigSetup(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.options.webpackConfig
    ).toBe('apps/app1/webpack.config.js');
    expect(
      readProjectConfiguration(tree, 'app2').targets.custom.options
        .webpackConfig
    ).toBe('apps/app2/webpack.config.js');

    expect(
      readProjectConfiguration(tree, 'app3').targets.custom.options
        .webpackConfig
    ).toBe('apps/app3/webpack.config.js');

    expect(
      readProjectConfiguration(tree, 'app4').targets.custom.options
        .webpackConfig
    ).toBe('some/random/path/webpack.something.ts');

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.options
        .isolatedConfig
    ).toBeTruthy();
    expect(
      readProjectConfiguration(tree, 'app2').targets.custom.options
        .isolatedConfig
    ).toBeTruthy();

    expect(
      readProjectConfiguration(tree, 'app3').targets.custom.options
        .isolatedConfig
    ).toBeTruthy();

    expect(
      readProjectConfiguration(tree, 'app4').targets.custom.options
        .isolatedConfig
    ).toBeTruthy();
  });

  it('should not do anything if isolatedConfig is true', async () => {
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

    await webpackConfigSetup(tree);

    expect(tree.exists('apps/app5/webpack.config.js')).toBeFalsy();
  });

  it('should not do anything if project is react', async () => {
    addProjectConfiguration(tree, 'app6', {
      root: 'apps/app6',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            webpackConfig: '@nrwl/react/plugins/webpack',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'app7', {
      root: 'apps/app7',
      targets: {
        custom: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/app7/src/main.tsx',
          },
        },
      },
    });

    await webpackConfigSetup(tree);

    expect(tree.exists('apps/app6/webpack.config.js')).toBeFalsy();
    expect(tree.exists('apps/app7/webpack.config.js')).toBeFalsy();
  });

  it('should migrate configurations (dev, prod, etc.) with webpackConfig but ignore ones without it', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            main: 'apps/myapp/src/main.ts',
            webpackConfig: 'apps/myapp/webpack.config.js',
          },
          configurations: {
            foo: {},
            bar: {
              webpackConfig: 'apps/myapp/webpack.config.bar.js',
            },
          },
        },
      },
    });
    tree.write('apps/myapp/webpack.config.js', 'default');
    tree.write('apps/myapp/webpack.config.bar.js', 'bar');

    addProjectConfiguration(tree, 'alreadymigrated', {
      root: 'apps/alreadymigrated',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            isolatedConfig: true,
            main: 'apps/alreadymigrated/src/main.ts',
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

    expect(tree.read('apps/myapp/webpack.config.old.js', 'utf-8')).toContain(
      'default'
    );
    expect(
      tree.read('apps/myapp/webpack.config.bar.old.js', 'utf-8')
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
