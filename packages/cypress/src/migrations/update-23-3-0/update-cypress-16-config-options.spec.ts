import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-cypress-16-config-options';

function addCypressProject(
  tree: Tree,
  name: string,
  config: string,
  configFile = 'cypress.config.ts'
): string {
  const root = `apps/${name}`;
  const cypressConfigPath = `${root}/${configFile}`;
  addProjectConfiguration(tree, name, {
    root,
    projectType: 'application',
    targets: {
      e2e: {
        executor: '@nx/cypress:cypress',
        options: { cypressConfig: cypressConfigPath },
      },
    },
  });
  tree.write(cypressConfigPath, config);
  return cypressConfigPath;
}

describe('update-cypress-16-config-options', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should rename and remove options at the top level and inside e2e/component', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  experimentalMemoryManagement: true,
  experimentalSourceRewriting: true,
  e2e: {
    baseUrl: 'http://localhost:4200',
    allowCypressEnv: false,
    execTimeout: 60000,
    experimentalFastVisibility: true,
  },
  component: {
    experimentalFastVisibility: false,
    experimentalMemoryManagement: false,
  },
});
`
    );

    const result = await migration(tree);

    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        'apps/app/cypress.config.ts: removed `experimentalSourceRewriting: true`; set `removeSRIAttributes: true`'
      ),
      expect.stringContaining(
        'apps/app/cypress.config.ts: removed `execTimeout: 60000`; `cy.exec()` is gone, set `taskTimeout`'
      ),
    ]);
    expect(result.agentContext).toHaveLength(2);
    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        manageBrowserMemory: true,
        e2e: {
          baseUrl: 'http://localhost:4200',
          visibilityStrategy: 'modern',
        },
        component: {
          visibilityStrategy: 'legacy',
          manageBrowserMemory: false,
        },
      });
      "
    `);
  });

  it('should keep the key quoting style', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    'experimentalMemoryManagement': true,
    "experimentalFastVisibility": true,
    'execTimeout': 1000,
  },
});
`,
      'cypress.config.js'
    );

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "const { defineConfig } = require('cypress');

      module.exports = defineConfig({
        e2e: {
          manageBrowserMemory: true,
          visibilityStrategy: 'modern',
        },
      });
      "
    `);
  });

  it('should drop the old option when the new one is already set', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    experimentalMemoryManagement: false,
    manageBrowserMemory: true,
    experimentalFastVisibility: true,
    visibilityStrategy: 'legacy',
  },
});
`
    );

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          manageBrowserMemory: true,
          visibilityStrategy: 'legacy',
        },
      });
      "
    `);
  });

  it('should report a non-literal experimentalFastVisibility value instead of guessing', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

const fast = process.env.FAST === 'true';

export default defineConfig({
  e2e: {
    experimentalFastVisibility: fast,
    execTimeout: 1000,
  },
});
`
    );

    const result = await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toContain(
      'experimentalFastVisibility: fast'
    );
    expect(tree.read(configPath, 'utf-8')).not.toContain('execTimeout');
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        'apps/app/cypress.config.ts: `experimentalFastVisibility` is set to a non-literal value (fast)'
      ),
      expect.stringContaining('removed `execTimeout: 1000`'),
    ]);
    expect(result.agentContext[0]).toContain(
      "`visibilityStrategy: 'modern'` (was true)"
    );
  });

  it('should not report a follow-up for experimentalSourceRewriting: false', async () => {
    addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  experimentalSourceRewriting: false,
});
`
    );

    expect(await migration(tree)).toBeUndefined();
  });

  it('should not touch options outside the config object', async () => {
    const config = `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on) {
      on('task', { execTimeout: 1000 });
    },
  },
});
`;
    const configPath = addCypressProject(tree, 'app', config);

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(config);
  });

  it('should not change configs without the removed options', async () => {
    const config = `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { baseUrl: 'http://localhost:4200' },
});
`;
    const configPath = addCypressProject(tree, 'app', config);

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(config);
  });

  it('should not throw on a syntactically broken config', async () => {
    addCypressProject(
      tree,
      'app',
      `export default defineConfig({ e2e: { allowCypressEnv: `
    );

    await expect(migration(tree)).resolves.toBeUndefined();
  });

  it('should be a no-op when run twice', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    experimentalMemoryManagement: true,
    experimentalFastVisibility: false,
    execTimeout: 1000,
  },
});
`
    );

    await migration(tree);
    const afterFirstRun = tree.read(configPath, 'utf-8');
    expect(afterFirstRun).toContain("visibilityStrategy: 'legacy'");

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(afterFirstRun);
  });
});
