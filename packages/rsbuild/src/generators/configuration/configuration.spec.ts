import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree } from '@nx/devkit';
import configurationGenerator from './configuration';

jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    createProjectGraphAsync: jest.fn().mockResolvedValue({
      dependencies: {},
      nodes: {
        myapp: {
          name: 'myapp',
          type: 'app',
          data: {
            root: 'apps/myapp',
            sourceRoot: 'apps/myapp/src',
            targets: {},
          },
        },
      },
    }),
  };
});

describe('Rsbuild configuration generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/myapp/project.json',
      JSON.stringify({
        name: 'myapp',
        projectType: 'application',
        root: 'apps/myapp',
        sourceRoot: 'apps/myapp/src',
        targets: {},
      })
    );
    tree.write(
      'apps/myapp/src/index.ts',
      'export function main() { console.log("Hello world"); }'
    );
  });

  it('should generate Rsbuild configuration files', async () => {
    await configurationGenerator(tree, {
      project: 'myapp',
      skipFormat: true,
    });

    expect(tree.exists('apps/myapp/rsbuild.config.ts')).toBeTruthy();
    expect(tree.read('apps/myapp/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from '@rsbuild/core';

      export default defineConfig({
          source: {
              entry: {
                  index: './src/index.ts'
              },
          },
          server: {
              port: 4200
          },
          output: {
              target: 'web',
              distPath: {
                  root: 'dist',
              },
          }
      });
      "
    `);
  });

  it('should generate Rsbuild configuration with custom entry file', async () => {
    tree.write(
      'apps/myapp/src/main.ts',
      'export function main() { console.log("Hello world"); }'
    );
    await configurationGenerator(tree, {
      project: 'myapp',
      entry: 'src/main.ts',
      skipFormat: true,
    });

    expect(tree.exists('apps/myapp/rsbuild.config.ts')).toBeTruthy();
    expect(tree.read('apps/myapp/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from '@rsbuild/core';

      export default defineConfig({
          source: {
              entry: {
                  index: './src/main.ts'
              },
          },
          server: {
              port: 4200
          },
          output: {
              target: 'web',
              distPath: {
                  root: 'dist',
              },
          }
      });
      "
    `);
  });

  it('should generate Rsbuild configuration with custom entry file with project root path', async () => {
    tree.write(
      'apps/myapp/src/main.ts',
      'export function main() { console.log("Hello world"); }'
    );
    await configurationGenerator(tree, {
      project: 'myapp',
      entry: 'apps/myapp/src/main.ts',
      skipFormat: true,
    });

    expect(tree.exists('apps/myapp/rsbuild.config.ts')).toBeTruthy();
    expect(tree.read('apps/myapp/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from '@rsbuild/core';

      export default defineConfig({
          source: {
              entry: {
                  index: './src/main.ts'
              },
          },
          server: {
              port: 4200
          },
          output: {
              target: 'web',
              distPath: {
                  root: 'dist',
              },
          }
      });
      "
    `);
  });

  it('should generate Rsbuild configuration with custom tsconfig file', async () => {
    await configurationGenerator(tree, {
      project: 'myapp',
      tsConfig: 'apps/myapp/tsconfig.json',
      skipFormat: true,
    });

    expect(tree.exists('apps/myapp/rsbuild.config.ts')).toBeTruthy();
    expect(tree.read('apps/myapp/rsbuild.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from '@rsbuild/core';

      export default defineConfig({
          source: {
              entry: {
                  index: './src/index.ts'
              },
              tsconfigPath: './tsconfig.json',
          },
          server: {
              port: 4200
          },
          output: {
              target: 'web',
              distPath: {
                  root: 'dist',
              },
          }
      });
      "
    `);
  });
});
