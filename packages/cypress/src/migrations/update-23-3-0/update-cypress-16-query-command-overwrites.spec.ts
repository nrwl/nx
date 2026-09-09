import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-cypress-16-query-command-overwrites';

describe('update-cypress-16-query-command-overwrites', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app-e2e', {
      root: 'apps/app-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: { cypressConfig: 'apps/app-e2e/cypress.config.ts' },
        },
      },
    });
    tree.write(
      'apps/app-e2e/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({ e2e: {} });
`
    );
  });

  it('should rename overwrite to overwriteQuery for the cookie and storage queries', async () => {
    tree.write(
      'apps/app-e2e/src/support/commands.ts',
      `Cypress.Commands.overwrite('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
Cypress.Commands.overwrite("getCookies", (originalFn, options) => originalFn(options));
Cypress.Commands.overwrite(\`getAllCookies\`, (originalFn, options) => originalFn(options));
Cypress.Commands.overwrite('getAllLocalStorage', (originalFn, options) => originalFn(options));
Cypress.Commands.overwrite('getAllSessionStorage', (originalFn, options) => originalFn(options));
Cypress.Commands.overwrite('visit', (originalFn, url, options) => originalFn(url, options));
`
    );

    const result = await migration(tree);

    expect(tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.Commands.overwriteQuery('getCookie', (originalFn, name, options) => {
        return originalFn(name, { ...options, log: false });
      });
      Cypress.Commands.overwriteQuery('getCookies', (originalFn, options) => originalFn(options));
      Cypress.Commands.overwriteQuery(\`getAllCookies\`, (originalFn, options) => originalFn(options));
      Cypress.Commands.overwriteQuery('getAllLocalStorage', (originalFn, options) => originalFn(options));
      Cypress.Commands.overwriteQuery('getAllSessionStorage', (originalFn, options) =>
        originalFn(options),
      );
      Cypress.Commands.overwrite('visit', (originalFn, url, options) => originalFn(url, options));
      "
    `);
    expect(result.skipAgentic).toBeFalsy();
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        "apps/app-e2e/src/support/commands.ts: `'getCookie'`, `\"getCookies\"`, `\`getAllCookies\``, `'getAllLocalStorage'`, `'getAllSessionStorage'`"
      ),
    ]);
    expect(result.agentContext).toEqual([
      expect.stringContaining('Renamed `Cypress.Commands.overwrite()`'),
    ]);
  });

  it('should rename overwrites in a shared library without a Cypress target', async () => {
    addProjectConfiguration(tree, 'testing-utils', {
      root: 'libs/testing-utils',
      projectType: 'library',
    });
    tree.write(
      'libs/testing-utils/src/commands.ts',
      `Cypress.Commands.overwrite('getCookie', (originalFn, name) => originalFn(name));
`
    );

    const result = await migration(tree);

    expect(tree.read('libs/testing-utils/src/commands.ts', 'utf-8')).toBe(
      `Cypress.Commands.overwriteQuery('getCookie', (originalFn, name) => originalFn(name));
`
    );
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        "libs/testing-utils/src/commands.ts: `'getCookie'`"
      ),
    ]);
  });

  it('should rename overwrites spelled with bracket access', async () => {
    tree.write(
      'apps/app-e2e/src/support/commands.ts',
      `Cypress.Commands['overwrite']('getCookie', (originalFn, name) => originalFn(name));
Cypress['Commands'].overwrite("getCookies", (originalFn, options) => originalFn(options));
Cypress.Commands[\`overwrite\`]('getAllCookies', (originalFn, options) => originalFn(options));
Cypress.Commands[overwrite]('getAllLocalStorage', (originalFn, options) => originalFn(options));
`
    );

    const result = await migration(tree);

    expect(tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.Commands['overwriteQuery']('getCookie', (originalFn, name) => originalFn(name));
      Cypress['Commands'].overwriteQuery('getCookies', (originalFn, options) => originalFn(options));
      Cypress.Commands[\`overwriteQuery\`]('getAllCookies', (originalFn, options) => originalFn(options));
      Cypress.Commands[overwrite]('getAllLocalStorage', (originalFn, options) => originalFn(options));
      "
    `);
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        "apps/app-e2e/src/support/commands.ts: `'getCookie'`, `\"getCookies\"`, `'getAllCookies'`"
      ),
    ]);
  });

  it.each([
    "const Cypress = require('./fake-cypress');",
    'let Cypress; Cypress = globalThis.Cypress;',
    'const { Cypress } = globalThis;',
    "import Cypress from './fake-cypress';",
    "import { Cypress } from './fake-cypress';",
    "import { fake as Cypress } from './fake-cypress';",
    "import * as Cypress from './fake-cypress';",
    "import Cypress = require('./fake-cypress');",
    'function Cypress() {}',
    'class Cypress {}',
    'enum Cypress {}',
    'namespace Cypress { export const Commands = { overwrite() {} }; }',
    'function setup(Cypress) {}',
  ])(
    'should leave a file that binds its own Cypress value alone and report it: %s',
    async (binding) => {
      const content = `${binding}
Cypress.Commands.overwrite('getCookie', (originalFn, name) => originalFn(name));
`;
      tree.write('apps/app-e2e/src/support/commands.ts', content);

      const result = await migration(tree);

      expect(tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8')).toBe(
        content
      );
      expect(result.skipAgentic).toBeFalsy();
      expect(result.nextSteps).toEqual([
        expect.stringContaining(
          'Left apps/app-e2e/src/support/commands.ts untouched because it declares its own `Cypress`'
        ),
      ]);
      expect(result.agentContext).toEqual(result.nextSteps);
    }
  );

  it.each([
    'declare global { namespace Cypress { interface Chainable { login(): void } } }',
    'declare namespace Cypress { interface Chainable { login(): void } }',
    'declare const Cypress: any;',
    "import type { Cypress } from './types';",
    "import { type Cypress } from './types';",
    "import type * as Cypress from './types';",
    "import type Cypress = require('./types');",
    'const { Cypress: local } = globalThis;',
  ])(
    'should rename overwrites next to a declaration that does not bind a Cypress value: %s',
    async (declaration) => {
      tree.write(
        'apps/app-e2e/src/support/commands.ts',
        `${declaration}
Cypress.Commands.overwrite('getCookie', (originalFn, name) => originalFn(name));
`
      );

      const result = await migration(tree);

      expect(
        tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8')
      ).toContain(
        "Cypress.Commands.overwriteQuery('getCookie', (originalFn, name) => originalFn(name));"
      );
      expect(result.nextSteps).toHaveLength(1);
      expect(result.nextSteps[0]).not.toContain('untouched');
    }
  );

  it('should not touch overwrites of commands that are not queries', async () => {
    const content = `Cypress.Commands.overwrite('visit', (originalFn, url) => originalFn(url));
Cypress.Commands.overwrite('setCookie', (originalFn, name, value) => originalFn(name, value));
`;
    tree.write('apps/app-e2e/src/support/commands.ts', content);

    const result = await migration(tree);

    expect(tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8')).toBe(
      content
    );
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not touch overwrite calls that are not on Cypress.Commands', async () => {
    const content = `registry.overwrite('getCookie', () => {});
`;
    tree.write('apps/app-e2e/src/support/commands.ts', content);

    const result = await migration(tree);

    expect(tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8')).toBe(
      content
    );
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not throw on a syntactically broken file', async () => {
    tree.write(
      'apps/app-e2e/src/support/commands.ts',
      `Cypress.Commands.overwrite('getCookie', (`
    );

    await expect(migration(tree)).resolves.toBeDefined();
  });

  it('should be a no-op when run twice', async () => {
    tree.write(
      'apps/app-e2e/src/support/commands.ts',
      `Cypress.Commands.overwrite('getCookie', (originalFn, name) => originalFn(name));
`
    );

    await migration(tree);
    const afterFirstRun = tree.read(
      'apps/app-e2e/src/support/commands.ts',
      'utf-8'
    );
    expect(afterFirstRun).toContain('overwriteQuery');

    const result = await migration(tree);

    expect(tree.read('apps/app-e2e/src/support/commands.ts', 'utf-8')).toBe(
      afterFirstRun
    );
    expect(result).toEqual({ skipAgentic: true });
  });
});
