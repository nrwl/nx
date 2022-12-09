import { testProjectsRoutes, testTaskRoutes } from '../support/routing-tests';
import {
  getCheckedProjectItems,
  getFocusButtonForProject,
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
    describe('focusProject', () => {
      it('should focus project', () => {
        cy.window().then((window) => {
          window.externalApi.focusProject('cart');

          const dependencies = nxExamplesJson.dependencies.cart;
          const dependents = Object.keys(nxExamplesJson.dependencies).filter(
            (key) =>
              nxExamplesJson.dependencies[key]
                .map((dependencies) => dependencies.target)
                .includes('cart')
          );
          getUnfocusProjectButton().should('exist');
          getCheckedProjectItems().should(
            'have.length',
            ['cart', ...dependencies, ...dependents].length
          );
          cy.url().should('contain', '/projects/cart');
        });
      });
    });
  });
});
