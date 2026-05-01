import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './rename-cy-exec-code-property';

describe('rename-cy-exec-code-property', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    const project: ProjectConfiguration = {
      root: 'apps/app-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app-e2e/cypress.config.ts',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app-e2e', project);
    tree.write(
      'apps/app-e2e/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {},
});`
    );
  });

  it("should rename cy.exec().its('code') to use exitCode", async () => {
    tree.write(
      'apps/app-e2e/src/e2e/sample.cy.ts',
      `describe('sample', () => {
  it('runs a task', () => {
    cy.exec('echo 0').its('code').should('eq', 0);
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/sample.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "describe('sample', () => {
        it('runs a task', () => {
          cy.exec('echo 0').its('exitCode').should('eq', 0);
        });
      });
      "
    `);
  });

  it('should handle chained cy.exec calls before its', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/chained.cy.ts',
      `cy.exec('echo 0')
  .then(() => {})
  .its("code")
  .should('eq', 0);
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/chained.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "cy.exec('echo 0')
        .then(() => {})
        .its('exitCode')
        .should('eq', 0);
      "
    `);
  });

  it('should handle multiple cy.exec calls in the same file', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/multiple.cy.ts',
      `describe('multiple', () => {
  it('first test', () => {
    cy.exec('cmd1').its('code').should('eq', 0);
  });

  it('second test', () => {
    cy.exec('cmd2').its("code").should("eq", 0);
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/multiple.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "describe('multiple', () => {
        it('first test', () => {
          cy.exec('cmd1').its('exitCode').should('eq', 0);
        });

        it('second test', () => {
          cy.exec('cmd2').its('exitCode').should('eq', 0);
        });
      });
      "
    `);
  });

  it('should handle deeply nested chains', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/deep.cy.ts',
      `cy.exec('echo test')
  .then((result) => result)
  .then((result) => result)
  .its('code')
  .should('eq', 0);
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/deep.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "cy.exec('echo test')
        .then((result) => result)
        .then((result) => result)
        .its('exitCode')
        .should('eq', 0);
      "
    `);
  });

  it('should preserve comments', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/comments.cy.ts',
      `it('test with comments', () => {
  // Check exit code
  cy.exec('echo 0').its('code').should('eq', 0);
  /* Another comment */
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/comments.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "it('test with comments', () => {
        // Check exit code
        cy.exec('echo 0').its('exitCode').should('eq', 0);
        /* Another comment */
      });
      "
    `);
  });

  it('should handle mixed quote styles in the same file', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/mixed.cy.ts',
      `describe('mixed quotes', () => {
  it('single quotes', () => {
    cy.exec('cmd1').its('code').should('eq', 0);
  });

  it('double quotes', () => {
    cy.exec("cmd2").its("code").should("eq", 0);
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/mixed.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "describe('mixed quotes', () => {
        it('single quotes', () => {
          cy.exec('cmd1').its('exitCode').should('eq', 0);
        });

        it('double quotes', () => {
          cy.exec('cmd2').its('exitCode').should('eq', 0);
        });
      });
      "
    `);
  });

  it('should handle cy.exec with complex command chains', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/complex.cy.ts',
      `it('complex chains', () => {
  cy.exec('echo test')
    .then((result) => {
      expect(result.stdout).to.include('test');
      return result;
    })
    .its('code')
    .should('eq', 0);
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/complex.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "it('complex chains', () => {
        cy.exec('echo test')
          .then((result) => {
            expect(result.stdout).to.include('test');
            return result;
          })
          .its('exitCode')
          .should('eq', 0);
      });
      "
    `);
  });

  it('should not modify its("code") when it does not follow cy.exec', async () => {
    tree.write(
      'apps/app-e2e/src/e2e/other-props.cy.ts',
      `it('checks multiple properties', () => {
  cy.exec('echo test').its('stdout').should('include', 'test');
  cy.exec('echo 0').its('code').should('eq', 0);
  cy.get('div').its('code');
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app-e2e/src/e2e/other-props.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "it('checks multiple properties', () => {
        cy.exec('echo test').its('stdout').should('include', 'test');
        cy.exec('echo 0').its('exitCode').should('eq', 0);
        cy.get('div').its('code');
      });
      "
    `);
  });
});
