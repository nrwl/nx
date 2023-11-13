import { createTree } from '@nx/devkit/testing';
import {
  addProjectConfiguration as _addProjectConfiguration,
  ProjectGraph,
  Tree,
} from '@nx/devkit';
import update from './add-dev-server-targets-to-cypress-configs';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

function addProjectConfiguration(tree, name, project) {
  _addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: 'lib',
    data: {
      root: project.root,
      targets: project.targets,
    },
  };
}

describe('add-dev-server-targets-to-cypress-configs migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();

    tree.write(
      'e2e/cypress.config.ts',
      `
      import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename),
  },
});
    `
    );

    projectGraph = {
      nodes: {},
      dependencies: {},
    };
  });

  it('should add devServerTargets to cypress.config.ts', async () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'e2e/cypress.config.ts',
            devServerTarget: 'my-app:serve',
          },
        },
      },
    });

    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should add dev server targets for default, production, and ci', async () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'e2e/cypress.config.ts',
            devServerTarget: 'my-app:serve',
          },
          configurations: {
            production: {
              devServerTarget: 'my-app:serve:production',
            },
            ci: {
              devServerTarget: 'my-app:serve-static',
            },
          },
        },
      },
    });
    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should update existing options with dev server targets for default, production, and ci', async () => {
    tree.write(
      'e2e/cypress.config.ts',
      `
      import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { bundler: 'vite' }),
  },
});
    `
    );
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'e2e/cypress.config.ts',
            devServerTarget: 'my-app:serve',
          },
          configurations: {
            production: {
              devServerTarget: 'my-app:serve:production',
            },
            ci: {
              devServerTarget: 'my-app:serve-static',
            },
          },
        },
      },
    });
    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not add nx metadata for if there are none to add', async () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {},
        },
      },
    });
    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });
});
