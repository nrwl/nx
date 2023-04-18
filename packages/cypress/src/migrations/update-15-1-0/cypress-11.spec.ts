import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { libraryGenerator } from '@nx/js';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import updateToCypress11 from './cypress-11';
import { installedCypressVersion } from '../../utils/cypress-version';
jest.mock('../../utils/cypress-version');
import { cypressComponentConfiguration } from '../../generators/cypress-component-configuration/cypress-component-configuration';

describe('Cypress 11 Migration', () => {
  let tree: Tree;
  let mockInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    jest.resetAllMocks();
  });

  it('should not update if cypress <v10 is used', async () => {
    // setup called the component setup. mock to v10 so it doesn't throw.
    mockInstalledCypressVersion.mockReturnValue(10);
    await setup(tree);
    mockInstalledCypressVersion.mockReturnValue(9);
    const beforeReact = tree.read(
      'libs/my-react-lib/src/lib/no-import.cy.ts',
      'utf-8'
    );

    const beforeNg = tree.read(
      'libs/my-ng-lib/src/lib/no-import.component.cy.ts',
      'utf-8'
    );

    await updateToCypress11(tree);
    const actualReact = tree.read(
      'libs/my-react-lib/src/lib/no-import.cy.ts',
      'utf-8'
    );

    const actualNg = tree.read(
      'libs/my-ng-lib/src/lib/no-import.component.cy.ts',
      'utf-8'
    );

    expect(actualReact).toEqual(beforeReact);
    expect(actualNg).toEqual(beforeNg);
  });

  it('should migrate to v11', async () => {
    mockInstalledCypressVersion.mockReturnValue(10);
    await setup(tree);
    await updateToCypress11(tree);
    expect(
      tree.read('libs/my-react-lib/src/lib/no-import.cy.ts', 'utf-8')
    ).toMatchSnapshot();

    expect(
      tree.read(
        'libs/my-react-lib/src/lib/with-import-18.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.read(
        'libs/my-react-lib/src/lib/with-import.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-ng-lib/src/lib/no-import.component.cy.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-ng-lib/src/lib/with-import.component.cy.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should only update component projects', async () => {
    addProjectConfiguration(tree, 'my-e2e-app', {
      projectType: 'application',
      root: 'apps/my-e2e-app',
      sourceRoot: 'apps/my-e2e-app/src',
      targets: {
        e2e: {
          executor: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: 'apps/my-e2e-app/cypress.config.ts',
          },
        },
      },
    });

    const content = `import { MountConfig } from 'cypress/angular';
import { MyComponent } from './my.component';
describe('MyComponent', () => {
  const config: MountConfig = {
    imports: [],
    declarations: [],
    providers: [{ provide: 'foo', useValue: 'bar' }],
  };
  it('direct usage', () => {
    cy.mount(MyComponent, config);
  });
});
`;
    tree.write('apps/my-e2e-app/src/somthing.component.cy.ts', content);
    await updateToCypress11(tree);
    expect(
      tree.read('apps/my-e2e-app/src/somthing.component.cy.ts', 'utf-8')
    ).toEqual(content);
  });
});

async function setup(tree: Tree) {
  await libraryGenerator(tree, {
    name: 'my-react-lib',
  });
  await cypressComponentConfiguration(tree, {
    project: 'my-react-lib',
    skipFormat: true,
  });
  const projectConfig = readProjectConfiguration(tree, 'my-react-lib');
  projectConfig.targets['component-test'].executor = '@nrwl/cypress:cypress';
  updateProjectConfiguration(tree, 'my-react-lib', projectConfig);
  tree.write(
    'libs/my-react-lib/cypress/support/commands.ts',
    `/// <reference types="cypress" />
import { mount } from 'cypress/react18'

declare global {
// eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      login(email: string, password: string): void;
      mount: typeof mount;
    }
  }
}
Cypress.Commands.add('mount', mount)
`
  );
  tree.write(
    'libs/my-react-lib/src/lib/no-import.cy.ts',
    `
it('calls the prop', () => {
  cy.mount(<Comp onUnmount={cy.stub().as('onUnmount')} />)
  cy.contains('My component')
})

describe('again', () => {
  it('calls the prop', () => {
    cy.mount(<Comp onUnmount={cy.stub().as('onUnmount')} />)
    cy.contains('My component')
  })
})`
  );
  tree.write(
    'libs/my-react-lib/src/lib/with-import.component.cy.ts',
    `import { mountHook, unmount } from 'cypress/react'
import { useCounter } from './useCounter'

it('increments the count', () => {
  mountHook(() => useCounter()).then((result) => {
    expect(result.current.count).to.equal(0)
    result.current.increment()
    expect(result.current.count).to.equal(1)
    result.current.increment()
    expect(result.current.count).to.equal(2)
  })
})

describe('blah', () => {

  it('increments the count', () => {
    mountHook(() => useCounter()).then((result) => {
      expect(result.current.count).to.equal(0)
      result.current.increment()
      expect(result.current.count).to.equal(1)
      result.current.increment()
      expect(result.current.count).to.equal(2)
    })
  })
})


it('calls the prop', () => {
  cy.mount(<Comp onUnmount={cy.stub().as('onUnmount')} />)
  cy.contains('My component')

  unmount()

  cy.contains('My component').should('not.exist')
  cy.get('@onUnmount').should('have.been.calledOnce')
})

describe('again', () => {
  it('calls the prop', () => {
    cy.mount(<Comp onUnmount={cy.stub().as('onUnmount')} />)
    cy.contains('My component')

    unmount()

    cy.contains('My component').should('not.exist')
    cy.get('@onUnmount').should('have.been.calledOnce')
  })
})`
  );
  tree.write(
    'libs/my-react-lib/src/lib/with-import-18.component.cy.ts',
    `import { mountHook, unmount } from 'cypress/react18';
import { useCounter } from './useCounter';

it('increments the count', () => {
  mountHook(() => useCounter()).then((result) => {
    expect(result.current.count).to.equal(0)
    result.current.increment()
    expect(result.current.count).to.equal(1)
    result.current.increment()
    expect(result.current.count).to.equal(2)
  })
})

describe('blah', () => {

  it('increments the count', () => {
    mountHook(() => useCounter()).then((result) => {
      expect(result.current.count).to.equal(0)
      result.current.increment()
      expect(result.current.count).to.equal(1)
      result.current.increment()
      expect(result.current.count).to.equal(2)
    })
  })
})


it('calls the prop', () => {
  cy.mount(<Comp onUnmount={cy.stub().as('onUnmount')} />)
  cy.contains('My component')

  unmount()

  cy.contains('My component').should('not.exist')
  cy.get('@onUnmount').should('have.been.calledOnce')
})

describe('again', () => {
  it('calls the prop', () => {
    cy.mount(<Comp onUnmount={cy.stub().as('onUnmount')} />)
    cy.contains('My component')

    unmount()

    cy.contains('My component').should('not.exist')
    cy.get('@onUnmount').should('have.been.calledOnce')
  })
})`
  );

  await libraryGenerator(tree, {
    name: 'my-ng-lib',
  });

  await cypressComponentConfiguration(tree, {
    project: 'my-ng-lib',
    skipFormat: true,
  });
  const projectConfig2 = readProjectConfiguration(tree, 'my-ng-lib');
  projectConfig2.targets['component-test'].executor = '@nrwl/cypress:cypress';
  updateProjectConfiguration(tree, 'my-ng-lib', projectConfig2);
  tree.write(
    'libs/my-ng-lib/cypress/support/commands.ts',
    `/// <reference types="cypress" />
import { mount } from 'cypress/angular'

declare global {
// eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      login(email: string, password: string): void;
      mount: typeof mount;
    }
  }
}
Cypress.Commands.add('mount', mount)
`
  );
  tree.write(
    'libs/my-ng-lib/src/lib/with-import.component.cy.ts',
    `import { MountConfig } from 'cypress/angular';
     import { MyComponent } from './my.component';
     import {TestBed} from '@angular/core/testing';
     describe('MyComponent', () => {
      const config: MountConfig = {
      imports: [],
      declarations: [],
      providers: [{provide: 'foo', useValue: 'bar'}]
      };
      it('direct usage', () => {
        cy.mount(MyComponent, config);
      });
      it('spread usage', () => {
        cy.mount(MyComponent, {...config, providers: [{provide: 'foo', useValue: 'bar'}] });
      });
      it('inlined usage', () => {
        cy.mount(MyComponent, {imports: [], declarations: [], providers: [{provide: 'foo', useValue: 'bar'}]});
      });
      });
    `
  );
  tree.write(
    'libs/my-ng-lib/src/lib/no-import.component.cy.ts',
    `
    import { MyComponent } from './my.component';
     describe('MyComponent', () => {
      const config = {
      imports: [],
      declarations: [],
      providers: [{provide: 'foo', useValue: 'bar'}]
      };
      it('direct usage', () => {
        cy.mount(MyComponent, config);
      });
      it('spread usage', () => {
        cy.mount(MyComponent, {...config, providers: [{provide: 'foo', useValue: 'bar'}] });
      });
      it('inlined usage', () => {
        cy.mount(MyComponent, {imports: [], declarations: [], providers: [{provide: 'foo', useValue: 'bar'}]});
      });
      });
   `
  );
}
