import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './replace-experimental-just-in-time-compile';

describe('replace-experimental-just-in-time-compile', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when there are no projects with cypress config', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.exists('apps/app1/cypress.config.ts')).toBe(false);
  });

  it('should do nothing when the cypress config cannot be parsed as expected', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write('apps/app1/cypress.config.ts', `export const foo = 'bar';`);

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.read('apps/app1/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export const foo = 'bar';
      "
    `);
  });

  it('should handle when the cypress config path in the executor is not valid', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        ct: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1/non-existent-cypress.config.ts',
          },
        },
      },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should handle cypress config files in projects using the "@nx/cypress:cypress" executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        ct: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1/cypress.custom-config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1/cypress.custom-config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
  },
  experimentalJustInTimeCompile: false,
});
`
    );

    await migration(tree);

    const config = tree.read('apps/app1/cypress.custom-config.ts', 'utf-8');
    expect(config).not.toContain('experimentalJustInTimeCompile');
    expect(config).not.toContain('justInTimeCompile');
  });

  it('should remove the experimentalJustInTimeCompile property from the top-level config when using vite', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
  },
  experimentalJustInTimeCompile: false,
});
`
    );

    await migration(tree);

    const config = tree.read('apps/app1/cypress.config.ts', 'utf-8');
    expect(config).not.toContain('experimentalJustInTimeCompile');
    expect(config).not.toContain('justInTimeCompile');
  });

  it('should remove the experimentalJustInTimeCompile property from the component config when using vite', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalJustInTimeCompile: false,
  },
});
`
    );

    await migration(tree);

    const config = tree.read('apps/app1/cypress.config.ts', 'utf-8');
    expect(config).not.toContain('experimentalJustInTimeCompile');
    expect(config).not.toContain('justInTimeCompile');
  });

  it('should remove the experimentalJustInTimeCompile property from both the top-level config and the component config when using vite', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalJustInTimeCompile: false,
  },
  experimentalJustInTimeCompile: false,
});
`
    );

    await migration(tree);

    const config = tree.read('apps/app1/cypress.config.ts', 'utf-8');
    expect(config).not.toContain('experimentalJustInTimeCompile');
    expect(config).not.toContain('justInTimeCompile');
  });

  it('should remove the experimentalJustInTimeCompile property from the top-level config when set to true and it is using webpack', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
  experimentalJustInTimeCompile: true,
});
`
    );

    await migration(tree);

    const config = tree.read('apps/app1/cypress.config.ts', 'utf-8');
    expect(config).not.toContain('experimentalJustInTimeCompile');
    expect(config).not.toContain('justInTimeCompile');
  });

  it('should rename the experimentalJustInTimeCompile property to justInTimeCompile in the top-level config when set to false and it is using webpack', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
  experimentalJustInTimeCompile: false,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'react',
              bundler: 'webpack',
            },
          },
          justInTimeCompile: false,
        });
        "
      `);
  });

  it('should remove the experimentalJustInTimeCompile property from the component config when set to true and it is using webpack', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    experimentalJustInTimeCompile: true,
  },
});
`
    );

    await migration(tree);

    const config = tree.read('apps/app1/cypress.config.ts', 'utf-8');
    expect(config).not.toContain('experimentalJustInTimeCompile');
    expect(config).not.toContain('justInTimeCompile');
  });

  it('should rename the experimentalJustInTimeCompile property to justInTimeCompile in the component config when set to false and it is using webpack', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    experimentalJustInTimeCompile: false,
  },
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'react',
              bundler: 'webpack',
            },
            justInTimeCompile: false,
          },
        });
        "
      `);
  });
});
