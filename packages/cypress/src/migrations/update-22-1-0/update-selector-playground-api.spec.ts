import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-selector-playground-api';

describe('update-selector-playground-api', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    const project: ProjectConfiguration = {
      root: 'apps/web-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/web-e2e/cypress.config.ts',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'web-e2e', project);
    tree.write(
      'apps/web-e2e/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {},
});`
    );
  });

  it('should rename Cypress.SelectorPlayground to Cypress.ElementSelector', async () => {
    tree.write(
      'apps/web-e2e/src/support/rename-only.ts',
      `Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/rename-only.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({
        selectorPriority: ['data-cy'],
      });
      "
    `);
  });

  it('should rename Cypress.SelectorPlayground to Cypress.ElementSelector and remove the onElement option', async () => {
    tree.write(
      'apps/web-e2e/src/support/selector.ts',
      `Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => el,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/selector.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({
        selectorPriority: ['data-cy'],
      });
      "
    `);
  });

  it('should keep files unchanged when Cypress.SelectorPlayground is not present', async () => {
    const original =
      "Cypress.ElementSelector.defaults({ selectorPriority: ['id'] });";
    tree.write('apps/web-e2e/src/support/keep.ts', original);

    await migration(tree);

    // trim to ignore trailing newline added by prettier
    expect(
      tree.read('apps/web-e2e/src/support/keep.ts', 'utf-8').trimEnd()
    ).toBe(original);
  });

  it('should handle onElement as a string literal key', async () => {
    tree.write(
      'apps/web-e2e/src/support/string-key.ts',
      `Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-test'],
  "onElement": (el) => el,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/string-key.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({
        selectorPriority: ['data-test'],
      });
      "
    `);
  });

  it('should handle multiple defaults() calls in the same file', async () => {
    tree.write(
      'apps/web-e2e/src/support/multiple.ts',
      `Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => el,
});

Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-test'],
  onElement: (el) => el.tagName,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/multiple.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "Cypress.ElementSelector.defaults({
          selectorPriority: ['data-cy'],
        });

        Cypress.ElementSelector.defaults({
          selectorPriority: ['data-test'],
        });
        "
      `);
  });

  it('should remove the onElement option from a defaults() call nested in another call', async () => {
    tree.write(
      'apps/web-e2e/src/support/nested.ts',
      `before(() => {
  Cypress.SelectorPlayground.defaults({ selectorPriority: ['id'], onElement: (el) => el });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/nested.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "before(() => {
        Cypress.ElementSelector.defaults({ selectorPriority: ['id'] });
      });
      "
    `);
  });

  it('should remove the onElement option from a defaults() call nested in another defaults() call', async () => {
    tree.write(
      'apps/web-e2e/src/support/nested-defaults.ts',
      `Cypress.ElementSelector.defaults({
  onElement: (el) => el,
  nested: Cypress.ElementSelector.defaults({ selectorPriority: ['id'], onElement: (el) => el }),
});
export const after = 1;
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/nested-defaults.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({
        nested: Cypress.ElementSelector.defaults({ selectorPriority: ['id'] }),
      });
      export const after = 1;
      "
    `);
  });

  it('should remove an onElement callback that holds another defaults() call', async () => {
    tree.write(
      'apps/web-e2e/src/support/nested-callback.ts',
      `Cypress.ElementSelector.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => {
    Cypress.ElementSelector.defaults({ onElement: (inner) => inner, selectorPriority: ['id'] });
    return el;
  },
});
export const after = 1;
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/nested-callback.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({
        selectorPriority: ['data-cy'],
      });
      export const after = 1;
      "
    `);
  });

  it('should handle onElement as the only property', async () => {
    tree.write(
      'apps/web-e2e/src/support/only.ts',
      `Cypress.SelectorPlayground.defaults({
  onElement: (el) => el,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/only.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({});
      "
    `);
  });

  it('should handle complex onElement function with multiple statements', async () => {
    tree.write(
      'apps/web-e2e/src/support/complex.ts',
      `Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => {
    console.log(el);
    return el;
  },
});
`
    );

    await migration(tree);

    expect(tree.read('apps/web-e2e/src/support/complex.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "Cypress.ElementSelector.defaults({
        selectorPriority: ['data-cy'],
      });
      "
    `);
  });
});
