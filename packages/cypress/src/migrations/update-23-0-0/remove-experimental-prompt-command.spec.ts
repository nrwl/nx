import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeExperimentalPromptCommand from './remove-experimental-prompt-command';

function setupProjectWithConfig(tree: Tree, contents: string): void {
  addProjectConfiguration(tree, 'app', {
    root: 'apps/app',
    projectType: 'application',
    targets: {
      e2e: {
        executor: '@nx/cypress:cypress',
        options: { cypressConfig: 'apps/app/cypress.config.ts' },
      },
    },
  });
  tree.write('apps/app/cypress.config.ts', contents);
}

describe('remove-experimental-prompt-command', () => {
  it('removes experimentalPromptCommand from e2e config', async () => {
    const tree = createTreeWithEmptyWorkspace();
    setupProjectWithConfig(
      tree,
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    experimentalPromptCommand: true,
    setupNodeEvents(on, config) {},
  },
});
`
    );

    await removeExperimentalPromptCommand(tree);

    expect(tree.read('apps/app/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          baseUrl: 'http://localhost:4200',

          setupNodeEvents(on, config) {},
        },
      });
      "
    `);
  });

  it('removes experimentalPromptCommand when last property', async () => {
    const tree = createTreeWithEmptyWorkspace();
    setupProjectWithConfig(
      tree,
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    experimentalPromptCommand: true,
  },
});
`
    );

    await removeExperimentalPromptCommand(tree);

    expect(tree.read('apps/app/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('removes experimentalPromptCommand when key is quoted', async () => {
    const tree = createTreeWithEmptyWorkspace();
    setupProjectWithConfig(
      tree,
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    'experimentalPromptCommand': true,
  },
});
`
    );

    await removeExperimentalPromptCommand(tree);

    expect(tree.read('apps/app/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('is a no-op when flag not present', async () => {
    const tree = createTreeWithEmptyWorkspace();
    setupProjectWithConfig(
      tree,
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
  },
});
`
    );

    await removeExperimentalPromptCommand(tree);

    expect(tree.read('apps/app/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('is idempotent', async () => {
    const tree = createTreeWithEmptyWorkspace();
    setupProjectWithConfig(
      tree,
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    experimentalPromptCommand: true,
    baseUrl: 'http://localhost:4200',
  },
});
`
    );

    await removeExperimentalPromptCommand(tree);
    await removeExperimentalPromptCommand(tree);

    expect(tree.read('apps/app/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });
});
