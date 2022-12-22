import { testProjectsRoutes, testTaskRoutes } from '../support/routing-tests';
import {
  getCheckedProjectItems,
  getDeselectAllButton,
  getFocusButtonForProject,
  getTextFilterInput,
  getUnfocusProjectButton,
} from '../support/app.po';
import * as nxExamplesJson from '../fixtures/nx-examples-project-graph.json';

describe('release static-mode app', () => {
  describe('smoke tests', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('should not display experimental features', () => {
      cy.get('experimental-features').should('not.exist');
    });

    it('should not display the debugger', () => {
      cy.get('debugger-panel').should('not.exist');
    });

    it('should use hash router', () => {
      cy.url().should('contain', '/#/projects');
    });
  });

  describe('routing', () => {
    testProjectsRoutes('hash', ['/projects']);
  });

  describe('api tests', () => {
    before(() => {
      cy.visit('/#/projects/');
    });

    afterEach(() => {
      // clean up by hiding all projects and clearing text input
      getDeselectAllButton().click();
      getTextFilterInput().clear();
      getCheckedProjectItems().should('have.length', 0);
    });

    describe('externalApi public api', () => {
      it('should focus project', () => {
        cy.window().then((window) => {
          window.externalApi.focusProject('cart');
          checkFocusedProject(nxExamplesJson, 'cart');
        });
      });

      it('should select all projects', () => {
        cy.window().then((window) => {
          window.externalApi.selectAllProjects();
          checkSelectAll(nxExamplesJson);
        });
      });
    });

    ['depGraphService', 'projectGraphService'].forEach((serviceName) => {
      describe(`deprecated api - ${serviceName}`, () => {
        it('should focus project', () => {
          cy.window().then((window) => {
            window.externalApi[serviceName].send({
              type: 'focusProject',
              projectName: 'cart',
            });
            checkFocusedProject(nxExamplesJson, 'cart');
          });
        });

        it('should select all projects', () => {
          cy.window().then((window) => {
            window.externalApi[serviceName].send({ type: 'selectAll' });
            checkSelectAll(nxExamplesJson);
          });
        });

        it('should select a project', () => {
          cy.window().then((window) => {
            window.externalApi[serviceName].send({
              type: 'selectProject',
              projectName: 'cart',
            });
            checkSelectedProject('cart');
          });
        });

        it('should deselect a project', () => {
          cy.window().then((window) => {
            window.externalApi[serviceName].send({
              type: 'selectProject',
              projectName: 'cart',
            });
            window.externalApi[serviceName].send({
              type: 'selectProject',
              projectName: 'cart-e2e',
            });
            window.externalApi[serviceName].send({
              type: 'deselectProject',
              projectName: 'cart',
            });

            checkSelectedProject('cart-e2e');
            checkDeselectedProject('cart');
          });
        });
      });
    });
  });
});

function checkFocusedProject(projectGraphJson: any, projectName: string) {
  const dependencies = projectGraphJson.dependencies.cart;
  const dependents = Object.keys(nxExamplesJson.dependencies).filter((key) =>
    nxExamplesJson.dependencies[key]
      .map((dependencies) => dependencies.target)
      .includes(projectName)
  );
  getUnfocusProjectButton().should('exist');
  getCheckedProjectItems().should(
    'have.length',
    [projectName, ...dependencies, ...dependents].length
  );
  cy.url().should('contain', `/projects/${projectName}`);
}

function checkSelectAll(projectGraphJson: any) {
  getCheckedProjectItems().should(
    'have.length',
    projectGraphJson.projects.length
  );
  cy.url().should('contain', `/projects/all`);
}

function checkSelectedProject(projectName: string) {
  cy.get(`[data-project="${projectName}"][data-active="true"]`).should('exist');
}

function checkDeselectedProject(projectName: string) {
  cy.get(`[data-project="${projectName}"][data-active="true"]`).should(
    'not.exist'
  );
}
