import { installedCypressVersion } from '../../utils/cypress-version';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addMountCommand,
  updateCyFile,
  updateCyMountUsage,
} from './update-cy-mount-usage';
import { libraryGenerator } from '@nx/js';
import { cypressComponentConfiguration } from '../../generators/cypress-component-configuration/cypress-component-configuration';

jest.mock('../../utils/cypress-version');
// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('update cy.mount usage', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    mockedInstalledCypressVersion.mockReturnValue(10);
  });

  it('should work', async () => {
    await setup(tree);
    await updateCyMountUsage(tree);

    expect(
      tree.read('libs/my-lib/cypress/support/commands.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-lib/src/lib/my-cmp-one.cy.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-lib/src/lib/my-cmp-two.cy.tsx', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-lib/src/lib/my-cmp-three.cy.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/another-lib/cypress/support/commands.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/another-lib/src/lib/my-cmp-one.cy.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/another-lib/src/lib/my-cmp-two.cy.tsx', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/another-lib/src/lib/my-cmp-three.cy.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should add the mount command', async () => {
    tree.write(
      'apps/my-app/cypress/support/commands.ts',
      `/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
   namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      login(email: string, password: string): void;
    }
  }
}

//
// -- This is a parent command --
Cypress.Commands.add('login', (email, password) => {
  console.log('Custom command example: Login', email, password);
});
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
`
    );
    addMountCommand(tree, 'apps/my-app', 'angular');
    expect(
      tree.read('apps/my-app/cypress/support/commands.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should update angular ct test file', () => {
    tree.write(
      'my-file.cy.ts',
      `
    import { MountConfig, mount } from 'cypress/angular';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(MyComponent);
      });

      it('should work with config', () => {
        mount(MyComponent, {...config, componentProperties: {foo: 'bar'}});
      });
    });
    `
    );
    updateCyFile(tree, 'my-file.cy.ts', 'angular');

    expect(tree.read('my-file.cy.ts', 'utf-8')).toMatchSnapshot();
  });
  it('should update angular react18 test file', () => {
    tree.write(
      'my-file.cy.ts',
      `
    import { mount } from 'cypress/react18';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(<MyComponent />);
      });

      it('should work with config', () => {
        mount(<MyComponent title={"blah"}/>);
      });
    });
    `
    );
    updateCyFile(tree, 'my-file.cy.ts', 'react18');

    expect(tree.read('my-file.cy.ts', 'utf-8')).toMatchSnapshot();
  });
  it('should update angular react test file', () => {
    tree.write(
      'my-file.cy.ts',
      `
    import { mount } from 'cypress/react';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(<MyComponent />);
      });

      it('should work with config', () => {
        mount(<MyComponent title={"blah"}/>,);
      });
    });
    `
    );
    updateCyFile(tree, 'my-file.cy.ts', 'react');

    expect(tree.read('my-file.cy.ts', 'utf-8')).toMatchSnapshot();
  });
});

async function setup(tree: Tree) {
  await libraryGenerator(tree, { name: 'my-lib' });
  await libraryGenerator(tree, { name: 'another-lib' });
  await cypressComponentConfiguration(tree, {
    project: 'my-lib',
    skipFormat: false,
  });
  await cypressComponentConfiguration(tree, {
    project: 'another-lib',
    skipFormat: false,
  });
  const myLib = readProjectConfiguration(tree, 'my-lib');
  myLib.targets['build'] = {
    executor: '@nrwl/angular:webpack-browser',
    options: {},
  };
  myLib.targets['component-test'].executor = '@nrwl/cypress:cypress';
  myLib.targets['component-test'].options.devServerTarget = 'my-lib:build';
  updateProjectConfiguration(tree, 'my-lib', myLib);
  const anotherLib = readProjectConfiguration(tree, 'another-lib');
  anotherLib.targets['build'] = {
    executor: '@nrwl/webpack:webpack',
    options: {},
  };
  anotherLib.targets['component-test'].executor = '@nrwl/cypress:cypress';
  anotherLib.targets['component-test'].options.devServerTarget =
    'another-lib:build';
  updateProjectConfiguration(tree, 'another-lib', anotherLib);
  tree.write(
    'libs/my-lib/cypress/support/commands.ts',
    `
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    login(email: string, password: string): void;
  }
}

// -- This is a parent command --
Cypress.Commands.add('login', (email, password) => {
  console.log('Custom command example: Login', email, password);
});`
  );
  tree.write(
    'libs/my-lib/src/lib/my-cmp-one.cy.js',
    `const { mount } =require('cypress/react');

    describe('MyComponent', () => {
      it('should work', () => {
        mount(<MyComponent />);
      });

      it('should work with config', () => {
        mount(<MyComponent title={"blah"}/>,);
      });
    });
    `
  );
  tree.write(
    'libs/my-lib/src/lib/my-cmp-two.cy.tsx',
    `import { mount } from 'cypress/react18';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(<MyComponent />);
      });

      it('should work with config', () => {
        mount(<MyComponent title={"blah"}/>,);
      });
    });
    `
  );
  tree.write(
    'libs/my-lib/src/lib/my-cmp-three.cy.ts',
    `import { mount, MountConfig } from 'cypress/angular';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(MyComponent);
      });

      it('should work with config', () => {
        mount(MyComponent, {...config, componentProperties: {foo: 'bar'}});
      });
    });
    `
  );

  tree.write(
    'libs/another-lib/cypress/support/commands.ts',
    `
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Chainable<Subject> {
    login(email: string, password: string): void;
    mount(c: any): void;
  }
}

// -- This is a parent command --
Cypress.Commands.add('login', (email, password) => {
  console.log('Custom command example: Login', email, password);
});
Cypress.Commands.add('mount', (any) => {
  console.log(mount);
});
`
  );

  tree.write(
    'libs/another-lib/src/lib/my-cmp-one.cy.js',
    `const { mount } = require('cypress/react');

    describe('MyComponent', () => {
      it('should work', () => {
        mount(<MyComponent />);
      });

      it('should work with config', () => {
        mount(<MyComponent title={"blah"}/>,);
      });
    });
    `
  );
  tree.write(
    'libs/another-lib/src/lib/my-cmp-two.cy.tsx',
    `import { mount } from 'cypress/react18';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(<MyComponent />);
      });

      it('should work with config', () => {
        mount(<MyComponent title={"blah"}/>,);
      });
    });
    `
  );
  tree.write(
    'libs/another-lib/src/lib/my-cmp-three.cy.ts',
    `import { mount, MountConfig } from 'cypress/angular';

    describe('MyComponent', () => {
      it('should work', () => {
        mount(MyComponent);
      });

      it('should work with config', () => {
        mount(MyComponent, {...config, componentProperties: {foo: 'bar'}});
      });
    });
    `
  );
}
