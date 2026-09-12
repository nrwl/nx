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

  it('should migrate quoted keys', async () => {
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

  it('should migrate shorthand properties and report the unknown values', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

const experimentalMemoryManagement = false;
const experimentalFastVisibility = true;
const experimentalSourceRewriting = false;
const execTimeout = 1000;

export default defineConfig({
  e2e: {
    experimentalMemoryManagement,
    experimentalFastVisibility,
    experimentalSourceRewriting,
    execTimeout,
  },
});
`
    );

    const result = await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      const experimentalMemoryManagement = false;
      const experimentalFastVisibility = true;
      const experimentalSourceRewriting = false;
      const execTimeout = 1000;

      export default defineConfig({
        e2e: {
          manageBrowserMemory: experimentalMemoryManagement,
          experimentalFastVisibility,
        },
      });
      "
    `);
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        'apps/app/cypress.config.ts: `experimentalFastVisibility` is set to a non-literal value (experimentalFastVisibility)'
      ),
      expect.stringContaining(
        'apps/app/cypress.config.ts: removed `experimentalSourceRewriting`; set `removeSRIAttributes: true`'
      ),
      expect.stringContaining(
        'apps/app/cypress.config.ts: removed `execTimeout`; `cy.exec()` is gone, set `taskTimeout`'
      ),
    ]);
  });

  it('should migrate computed keys with a static name', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ['experimentalMemoryManagement']: true,
    [\`experimentalFastVisibility\`]: false,
    ["execTimeout"]: 1000,
  },
});
`
    );

    const result = await migration(tree);

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
    expect(result.nextSteps).toEqual([
      expect.stringContaining('removed `["execTimeout"]: 1000`'),
    ]);
  });

  it('should not touch computed keys resolved at runtime', async () => {
    const config = `import { defineConfig } from 'cypress';

const execTimeout = 'taskTimeout';
const experimentalMemoryManagement = 'manageBrowserMemory';

export default defineConfig({
  e2e: {
    [execTimeout]: 120000,
    [experimentalMemoryManagement]: true,
  },
});
`;
    const configPath = addCypressProject(tree, 'app', config);

    const result = await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toBe(config);
    expect(result).toBeUndefined();
  });

  it('should drop the old option when a shorthand new one is already set', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

const manageBrowserMemory = false;

export default defineConfig({
  e2e: {
    experimentalMemoryManagement: true,
    manageBrowserMemory,
  },
});
`
    );

    await migration(tree);

    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      const manageBrowserMemory = false;

      export default defineConfig({
        e2e: {
          manageBrowserMemory,
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

  it.each([
    [
      'a block comment before the comma',
      `  allowCypressEnv: true /* explanation */,\n`,
      '',
    ],
    ['whitespace before the comma', `  allowCypressEnv: true ,\n`, ''],
    ['the comma on the next line', `  allowCypressEnv: true\n  ,\n`, ''],
    [
      'the new option already set and a comment before the comma',
      `  experimentalMemoryManagement: true /* explanation */,\n  manageBrowserMemory: true,\n`,
      `  manageBrowserMemory: true,\n`,
    ],
  ])(
    'should remove the separator of a removed option with %s',
    async (_, before, after) => {
      const configPath = addCypressProject(
        tree,
        'app',
        `import { defineConfig } from 'cypress';\n\nexport default defineConfig({\n${before}  e2e: {},\n});\n`
      );

      await migration(tree);

      expect(tree.read(configPath, 'utf-8')).toBe(
        `import { defineConfig } from 'cypress';\n\nexport default defineConfig({\n${after}  e2e: {},\n});\n`
      );
    }
  );

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

  it('should migrate a config exported through a variable holding defineConfig()', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

const config = defineConfig({
  experimentalMemoryManagement: false,
  e2e: {
    execTimeout: 1000,
  },
});

export default config;
`
    );

    const result = await migration(tree);

    expect(result.nextSteps).toEqual([
      expect.stringContaining('removed `execTimeout: 1000`'),
    ]);
    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      const config = defineConfig({
        manageBrowserMemory: false,
        e2e: {},
      });

      export default config;
      "
    `);
  });

  it('should migrate e2e and component blocks held in variables', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

const e2eConfig = {
  baseUrl: 'http://localhost:4200',
  experimentalFastVisibility: true,
};
const component = {
  experimentalMemoryManagement: false,
  allowCypressEnv: true,
};

export default defineConfig({
  e2e: e2eConfig,
  component,
});
`
    );

    const result = await migration(tree);

    expect(result).toBeUndefined();
    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      const e2eConfig = {
        baseUrl: 'http://localhost:4200',
        visibilityStrategy: 'modern',
      };
      const component = {
        manageBrowserMemory: false,
      };

      export default defineConfig({
        e2e: e2eConfig,
        component,
      });
      "
    `);
  });

  it('should migrate a block shared by e2e and component once', async () => {
    const configPath = addCypressProject(
      tree,
      'app',
      `import { defineConfig } from 'cypress';

const shared = {
  experimentalMemoryManagement: false,
  execTimeout: 1000,
  experimentalFastVisibility: true,
};
const e2e = shared;

export default defineConfig({ e2e, component: shared });
`
    );

    const result = await migration(tree);

    expect(result.nextSteps).toEqual([
      'Review the Cypress config option change: apps/app/cypress.config.ts: removed `execTimeout: 1000`; `cy.exec()` is gone, set `taskTimeout` if the replacement `cy.task()` needs more than the 60000ms default',
    ]);
    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';

      const shared = {
        manageBrowserMemory: false,
        visibilityStrategy: 'modern',
      };
      const e2e = shared;

      export default defineConfig({ e2e, component: shared });
      "
    `);
  });

  it('should report a config it cannot resolve statically', async () => {
    const config = `import { defineConfig } from 'cypress';
import { baseConfig } from '@acme/cypress-config';

export default defineConfig(
  baseConfig({ experimentalMemoryManagement: false, execTimeout: 1000 })
);
`;
    const configPath = addCypressProject(tree, 'app', config);

    const result = await migration(tree);

    expect(result.nextSteps).toEqual([
      'Review the Cypress config option change: apps/app/cypress.config.ts: the config object could not be resolved statically; it mentions `execTimeout`, `experimentalMemoryManagement`, migrate those by hand',
    ]);
    expect(tree.read(configPath, 'utf-8')).toBe(config);
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
