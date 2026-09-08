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
