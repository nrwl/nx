import * as nxExamplesJson from '../fixtures/nx-examples.json';
import {
  getCheckedProjectItems,
  getGroupByFolderCheckbox,
  getSearchDepthCheckbox,
} from './app.po';

function waitForGraph(router: 'hash' | 'browser') {
  if (router === 'browser') {
    cy.wait('@getGraph');
  }
}

function resolveRoute(
  router: 'hash' | 'browser',
  route: string,
  paramString: string
) {
  if (router === 'hash') {
    return `/?${paramString}#${route}`;
  } else {
    return `${route}?${paramString}`;
  }
}
export function testProjectsRoutes(
  router: 'hash' | 'browser',
  routes: string[]
) {
  routes.forEach((route) => {
    describe(`for route ${route}`, () => {
      it('should focus projects', () => {
        cy.visit(resolveRoute(router, route, 'focus=cart'));

        // wait for first graph to finish loading
        waitForGraph(router);

        const dependencies = nxExamplesJson.dependencies.cart;
        const dependents = Object.keys(nxExamplesJson.dependencies).filter(
          (key) =>
            nxExamplesJson.dependencies[key]
              .map((dependencies) => dependencies.target)
              .includes('cart')
        );
        getCheckedProjectItems().should(
          'have.length',
          ['cart', ...dependencies, ...dependents].length
        );
      });

      it('should focus projects with search depth', () => {
        cy.visit(resolveRoute(router, route, `focus=cart&searchDepth=2`));

        // wait for first graph to finish loading
        waitForGraph(router);

        getCheckedProjectItems().should('have.length', 10);
        getSearchDepthCheckbox().should('exist');
      });

      it('should focus projects with search depth disabled', () => {
        cy.visit(resolveRoute(router, route, `focus=cart&searchDepth=0`));

        // wait for first graph to finish loading
        waitForGraph(router);

        getCheckedProjectItems().should('have.length', 12);
        getSearchDepthCheckbox().should('exist');
      });

      it('should set group by folder', () => {
        cy.visit(
          resolveRoute(
            router,
            route,
            `focus=nx-dev&searchDepth=1&groupByFolder=true`
          )
        );

        // wait for first graph to finish loading
        waitForGraph(router);

        getGroupByFolderCheckbox().should('be.checked');
      });

      it('should select all projects', () => {
        cy.visit(resolveRoute(router, route, `select=all`));

        // wait for first graph to finish loading
        waitForGraph(router);

        getCheckedProjectItems().should(
          'have.length',
          nxExamplesJson.projects.length
        );
      });
    });
  });
}
