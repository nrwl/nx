import {
  addProjectConfiguration,
  readJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-component-testing-mount-imports';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
}));

describe('update-component-testing-mount-imports', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when there are no projects with cypress config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(false);
  });

  it('should do nothing when the cypress config cannot be parsed as expected', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });
    tree.write('apps/app1-e2e/cypress.config.ts', `export const foo = 'bar';`);

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export const foo = 'bar';
      "
    `);
  });

  it('should handle when the cypress config path in the executor is not valid', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/non-existent-cypress.config.ts',
          },
        },
      },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should convert import from cypress/react18 to cypress/react', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});`
    );
    tree.write(
      'apps/app1/src/app/App.cy.tsx',
      `import { mount } from 'cypress/react18';
describe('App', () => {
  it('should render', () => {
    mount(<App />);
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app/App.cy.tsx', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { mount } from 'cypress/react';
        describe('App', () => {
          it('should render', () => {
            mount(<App />);
          });
        });
        "
      `);
  });

  it('should convert import from cypress/angular-signals to cypress/angular', async () => {
    const project: ProjectConfiguration = {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    };
    projectGraph = {
      nodes: { app1: { name: 'app1', type: 'app', data: project } },
      dependencies: {
        app1: [{ target: 'npm:@angular/core', type: 'static', source: 'app1' }],
      },
      externalNodes: {
        'npm:@angular/core': {
          name: 'npm:@angular/core',
          type: 'npm',
          data: {
            packageName: '@angular/core',
            version: '19.0.0',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app1', project);
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});`
    );
    tree.write(
      'apps/app1/src/app/app.component.cy.ts',
      `import { mount } from 'cypress/angular-signals';
describe('App', () => {
  it('should render', () => {
    mount(AppComponent, {})
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app/app.component.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { mount } from 'cypress/angular';
        describe('App', () => {
          it('should render', () => {
            mount(AppComponent, {});
          });
        });
        "
      `);
  });

  it('should convert import from cypress/angular to @cypress/angular and install the package if it is a version lower than v17.2.0', async () => {
    const project: ProjectConfiguration = {
      root: 'apps/app1',
      projectType: 'application',
      targets: {},
    };
    projectGraph = {
      nodes: { app1: { name: 'app1', type: 'app', data: project } },
      dependencies: {
        app1: [{ target: 'npm:@angular/core', type: 'static', source: 'app1' }],
      },
      externalNodes: {
        'npm:@angular/core': {
          name: 'npm:@angular/core',
          type: 'npm',
          data: {
            packageName: '@angular/core',
            version: '17.1.3',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app1', project);
    tree.write(
      'apps/app1/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});`
    );
    tree.write(
      'apps/app1/src/app/app.component.cy.ts',
      `import { mount } from 'cypress/angular';
describe('App', () => {
  it('should render', () => {
    mount(AppComponent, {})
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app/app.component.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { mount } from '@cypress/angular';
        describe('App', () => {
          it('should render', () => {
            mount(AppComponent, {});
          });
        });
        "
      `);
    expect(
      readJson(tree, 'package.json').devDependencies['@cypress/angular']
    ).toBeDefined();
  });
});
