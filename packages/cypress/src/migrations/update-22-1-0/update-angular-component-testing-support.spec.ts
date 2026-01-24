import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-angular-component-testing-support';

let projectGraph: ProjectGraph;

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
}));

describe('update-angular-component-testing-support', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should switch cypress/angular imports to @cypress/angular for Angular < 18', async () => {
    const project: ProjectConfiguration = {
      root: 'apps/dashboard',
      projectType: 'application',
      targets: {
        'component-test': {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/dashboard/cypress.config.ts',
            testingType: 'component',
          },
        },
      },
    };
    projectGraph = {
      nodes: { dashboard: { name: 'dashboard', type: 'app', data: project } },
      dependencies: {
        dashboard: [
          { target: 'npm:@angular/core', type: 'static', source: 'dashboard' },
        ],
      },
      externalNodes: {
        'npm:@angular/core': {
          name: 'npm:@angular/core',
          type: 'npm',
          data: { packageName: '@angular/core', version: '17.3.0' },
        },
      },
    };
    addProjectConfiguration(tree, 'dashboard', project);
    tree.write(
      'apps/dashboard/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});
`
    );
    tree.write(
      'apps/dashboard/src/app/app.component.cy.ts',
      `import { mount } from 'cypress/angular';

describe('AppComponent', () => {
  it('renders', () => {
    mount('<app-root></app-root>');
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/dashboard/src/app/app.component.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mount } from '@cypress/angular';
      describe('AppComponent', () => {
        it('renders', () => {
          mount('<app-root></app-root>');
        });
      });
      "
    `);
    expect(
      readJson(tree, 'package.json').devDependencies['@cypress/angular']
    ).toEqual('^3.0.0');
  });

  it('should bump existing @cypress/angular dependency to ^3.0.0', async () => {
    const project: ProjectConfiguration = {
      root: 'apps/admin',
      projectType: 'application',
      targets: {
        'component-test': {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/admin/cypress.config.ts',
            testingType: 'component',
          },
        },
      },
    };
    projectGraph = {
      nodes: { admin: { name: 'admin', type: 'app', data: project } },
      dependencies: {
        admin: [
          { target: 'npm:@angular/core', type: 'static', source: 'admin' },
        ],
      },
      externalNodes: {
        'npm:@angular/core': {
          name: 'npm:@angular/core',
          type: 'npm',
          data: { packageName: '@angular/core', version: '17.0.0' },
        },
      },
    };
    addProjectConfiguration(tree, 'admin', project);
    tree.write(
      'apps/admin/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'vite',
    },
  },
});
`
    );
    tree.write(
      'apps/admin/src/app/app.component.cy.ts',
      `import { mount } from '@cypress/angular';
mount('<app-root></app-root>');
`
    );
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies['@cypress/angular'] = '^2.1.0';
      return json;
    });

    await migration(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@cypress/angular']
    ).toEqual('^3.0.0');
  });

  it('should skip projects using Angular >= 18', async () => {
    const project: ProjectConfiguration = {
      root: 'apps/portal',
      projectType: 'application',
      targets: {
        'component-test': {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/portal/cypress.config.ts',
            testingType: 'component',
          },
        },
      },
    };
    projectGraph = {
      nodes: { portal: { name: 'portal', type: 'app', data: project } },
      dependencies: {
        portal: [
          { target: 'npm:@angular/core', type: 'static', source: 'portal' },
        ],
      },
      externalNodes: {
        'npm:@angular/core': {
          name: 'npm:@angular/core',
          type: 'npm',
          data: { packageName: '@angular/core', version: '18.0.0' },
        },
      },
    };
    addProjectConfiguration(tree, 'portal', project);
    tree.write(
      'apps/portal/cypress.config.ts',
      `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});
`
    );
    tree.write(
      'apps/portal/src/app/app.component.cy.ts',
      `import { mount } from 'cypress/angular';
mount('<app-root></app-root>');
`
    );

    await migration(tree);

    expect(tree.read('apps/portal/src/app/app.component.cy.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mount } from 'cypress/angular';
      mount('<app-root></app-root>');
      "
    `);
    expect(
      readJson(tree, 'package.json').devDependencies['@cypress/angular']
    ).toBeUndefined();
  });
});
