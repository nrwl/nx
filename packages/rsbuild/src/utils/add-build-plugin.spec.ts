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
});
