import { addBuildPlugin } from './add-build-plugin';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('addBuildPlugin', () => {
  it('should add the plugin to the config file when plugins array does not exist', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts'
    },
  }
});`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-less',
      'less'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { less } from '@rsbuild/plugin-less';
        import { defineConfig } from '@rsbuild/core';
      export default defineConfig({
      	plugins: [less()],
      	
        source: {
          entry: {
            index: './src/index.ts'
          },
        }
      });"
    `);
  });

  it('should add the plugin to the config file when plugins array exists and has other plugins', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
      import { less } from '@rsbuild/plugin-less';
export default defineConfig({
  plugins: [less()],
  source: {
    entry: {
      index: './src/index.ts'
    },
  }
});`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { pluginReact } from '@rsbuild/plugin-react';
        import { defineConfig } from '@rsbuild/core';
            import { less } from '@rsbuild/plugin-less';
      export default defineConfig({
        plugins: [
      		less(),
      		pluginReact()
      	],
        source: {
          entry: {
            index: './src/index.ts'
          },
        }
      });"
    `);
  });

  it('should add the plugin to the config file when plugins array exists and is empty', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
export default defineConfig({
  plugins: [],
  source: {
    entry: {
      index: './src/index.ts'
    },
  }
});`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { pluginReact } from '@rsbuild/plugin-react';
        import { defineConfig } from '@rsbuild/core';
      export default defineConfig({
        plugins: [
      		pluginReact()
      	],
        source: {
          entry: {
            index: './src/index.ts'
          },
        }
      });"
    `);
  });
  it('should add the plugin to the config file when plugins doesnt not exist and its being added with options', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
export default defineConfig({
  plugins: [],
  source: {
    entry: {
      index: './src/index.ts'
    },
  }
});`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact',
      `swcReactOptions: {\n\timportSource: '@emotion/react',\n}`
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { pluginReact } from '@rsbuild/plugin-react';
        import { defineConfig } from '@rsbuild/core';
      export default defineConfig({
        plugins: [
      		pluginReact({
      			swcReactOptions: {
      				importSource: '@emotion/react',
      			}
      		})
      	],
        source: {
          entry: {
            index: './src/index.ts'
          },
        }
      });"
    `);
  });

  it('should append after a trailing comma without leaving an array hole', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
import { less } from '@rsbuild/plugin-less';
export default defineConfig({
  plugins: [
    less(),
  ],
});`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { pluginReact } from '@rsbuild/plugin-react';
          import { defineConfig } from '@rsbuild/core';
        import { less } from '@rsbuild/plugin-less';
        export default defineConfig({
          plugins: [
        		less(),
        		pluginReact()
        	],
        });"
      `);
  });

  it('should append to the plugins of a config returned from an arrow function', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
export default defineConfig(({ envMode }) => ({
  plugins: [pluginSass()],
  server: { port: envMode === 'test' ? 4300 : 4200 },
}));`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8')).toContain(
      'plugins: [\n\t\tpluginSass(),\n\t\tpluginReact()\n\t],'
    );
  });

  it('should add a plugins array to a config returned from an arrow function', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
export default defineConfig(() => ({
  server: { port: 4200 },
}));`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8')).toContain(
      'export default defineConfig(() => ({\n\tplugins: [pluginReact()],'
    );
  });

  it.each([
    [
      'an arrow function with a block body',
      `export default defineConfig(({ envMode }) => {
  const port = envMode === 'test' ? 4300 : 4200;
  return { plugins: [pluginSass()], server: { port } };
});`,
    ],
    [
      'a function expression',
      `export default defineConfig(function () {
  return { plugins: [pluginSass()] };
});`,
    ],
  ])(
    'should append to the plugins of a config returned from %s',
    (_, config) => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import { defineConfig } from '@rsbuild/core';\n${config}`
      );

      // ACT
      addBuildPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@rsbuild/plugin-react',
        'pluginReact'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8')).toContain(
        'plugins: [\n\t\tpluginSass(),\n\t\tpluginReact()\n\t]'
      );
    }
  );

  it('should add a plugins array when only tools.rspack.plugins exists', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/my-app/rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';
export default defineConfig({
  tools: {
    rspack: {
      plugins: [new BundleAnalyzerPlugin()],
    },
  },
});`
    );

    // ACT
    addBuildPlugin(
      tree,
      'apps/my-app/rsbuild.config.ts',
      '@rsbuild/plugin-react',
      'pluginReact'
    );

    // ASSERT
    expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { pluginReact } from '@rsbuild/plugin-react';
          import { defineConfig } from '@rsbuild/core';
        export default defineConfig({
        	plugins: [pluginReact()],
        	
          tools: {
            rspack: {
              plugins: [new BundleAnalyzerPlugin()],
            },
          },
        });"
      `);
  });
});
