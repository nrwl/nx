import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-angular-zoneless-mount-import';

describe('update-angular-zoneless-mount-import', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      projectType: 'application',
      targets: {
        'component-test': {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app/cypress.config.ts',
            testingType: 'component',
          },
        },
      },
    });
    tree.write(
      'apps/app/cypress.config.ts',
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
export default defineConfig({ component: nxComponentTestingPreset(__filename) });
`
    );
  });

  it('should rewrite cypress/angular-zoneless imports to cypress/angular', async () => {
    tree.write(
      'apps/app/cypress/support/component.ts',
      `import { mount } from 'cypress/angular-zoneless';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
`
    );
    tree.write(
      'apps/app/src/app/app.cy.ts',
      `import type { MountConfig } from "cypress/angular-zoneless";
export * from \`cypress/angular-zoneless\`;
const { mount } = require('cypress/angular-zoneless');
const lazy = () => import('cypress/angular-zoneless');
type T = typeof import('cypress/angular-zoneless');
`
    );

    await migration(tree);

    expect(tree.read('apps/app/cypress/support/component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mount } from 'cypress/angular';
      import './commands';

      declare global {
        namespace Cypress {
          interface Chainable<Subject> {
            mount: typeof mount;
          }
        }
      }

      Cypress.Commands.add('mount', mount);
      "
    `);
    expect(tree.read('apps/app/src/app/app.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import type { MountConfig } from "cypress/angular";
      export * from \`cypress/angular\`;
      const { mount } = require('cypress/angular');
      const lazy = () => import('cypress/angular');
      type T = typeof import('cypress/angular');
      "
    `);
  });

  it('should rewrite @cypress/angular-zoneless imports and remove the package', async () => {
    tree.write(
      'apps/app/cypress/support/component.ts',
      `import { mount } from '@cypress/angular-zoneless';\n`
    );
    tree.write(
      'apps/app/src/app/app.cy.ts',
      `import type { MountConfig } from '@cypress/angular-zoneless';\n`
    );
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@cypress/angular-zoneless': '^1.0.0' },
      devDependencies: {
        '@cypress/angular-zoneless': '^1.0.0',
        cypress: '^16.0.0',
      },
    }));

    const result = await migration(tree);

    expect(result).toBeUndefined();
    expect(tree.read('apps/app/cypress/support/component.ts', 'utf-8')).toBe(
      `import { mount } from 'cypress/angular';\n`
    );
    expect(tree.read('apps/app/src/app/app.cy.ts', 'utf-8')).toBe(
      `import type { MountConfig } from 'cypress/angular';\n`
    );
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({});
    expect(devDependencies).toEqual({ cypress: '^16.0.0' });
  });

  it('should rewrite imports in a shared library without a Cypress target', async () => {
    addProjectConfiguration(tree, 'testing-utils', {
      root: 'libs/testing-utils',
      projectType: 'library',
    });
    tree.write(
      'libs/testing-utils/src/mount.ts',
      `export { mount } from 'cypress/angular-zoneless';\n`
    );

    await migration(tree);

    expect(tree.read('libs/testing-utils/src/mount.ts', 'utf-8')).toBe(
      `export { mount } from 'cypress/angular';\n`
    );
  });

  it('should leave package.json alone when @cypress/angular-zoneless is not installed', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { cypress: '^16.0.0' },
    }));
    const before = tree.read('package.json', 'utf-8');

    const result = await migration(tree);

    expect(result).toBeUndefined();
    expect(tree.read('package.json', 'utf-8')).toBe(before);
  });

  it('should leave require() calls alone in a file that binds its own require and report it', async () => {
    tree.write(
      'apps/app/src/app/app.cy.ts',
      `import { mount } from 'cypress/angular-zoneless';
const require = (id: string) => registry.get(id);
const { MountConfig } = require('cypress/angular-zoneless');
`
    );

    const result = await migration(tree);

    expect(tree.read('apps/app/src/app/app.cy.ts', 'utf-8')).toBe(
      `import { mount } from 'cypress/angular';
const require = (id: string) => registry.get(id);
const { MountConfig } = require('cypress/angular-zoneless');
`
    );
    expect(result.nextSteps).toEqual([
      expect.stringContaining(
        'Left the `require()` calls in apps/app/src/app/app.cy.ts untouched because it declares its own `require`'
      ),
    ]);
    expect(result.agentContext).toEqual(result.nextSteps);
  });

  it('should rewrite require() calls next to an ambient require declaration', async () => {
    tree.write(
      'apps/app/src/app/app.cy.ts',
      `declare const require: NodeRequire;
const { mount } = require('cypress/angular-zoneless');
`
    );

    const result = await migration(tree);

    expect(result).toBeUndefined();
    expect(tree.read('apps/app/src/app/app.cy.ts', 'utf-8')).toBe(
      `declare const require: NodeRequire;
const { mount } = require('cypress/angular');
`
    );
  });

  it('should not rewrite the specifier outside module references', async () => {
    const content = `const label = 'cypress/angular-zoneless';
describe('cypress/angular-zoneless', () => {});
type Harness = 'cypress/angular-zoneless';
type Harnesses = 'cypress/angular' | 'cypress/angular-zoneless';
const harness: Harness = 'cypress/angular-zoneless';
`;
    tree.write('apps/app/src/app/app.cy.ts', content);

    await migration(tree);

    expect(tree.read('apps/app/src/app/app.cy.ts', 'utf-8')).toBe(content);
  });

  it('should skip an unparseable file without throwing', async () => {
    const content = `import { mount } from 'cypress/angular-zoneless'\nconst x = (`;
    tree.write('apps/app/src/app/app.cy.ts', content);

    await expect(migration(tree)).resolves.toBeUndefined();

    expect(tree.read('apps/app/src/app/app.cy.ts', 'utf-8')).toContain(
      "from 'cypress/angular'\n"
    );
  });

  it('should be a no-op when run twice', async () => {
    tree.write(
      'apps/app/cypress/support/component.ts',
      `import { mount } from 'cypress/angular-zoneless';\n`
    );

    await migration(tree);
    const afterFirstRun = tree.read(
      'apps/app/cypress/support/component.ts',
      'utf-8'
    );
    expect(afterFirstRun).toBe(`import { mount } from 'cypress/angular';\n`);

    await migration(tree);

    expect(tree.read('apps/app/cypress/support/component.ts', 'utf-8')).toBe(
      afterFirstRun
    );
  });
});
