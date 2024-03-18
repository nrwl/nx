import * as nxExamplesJson from '../fixtures/nx-examples-project-graph.json';
import {
  getCheckedProjectItems,
  getGroupByFolderCheckbox,
  getGroupByProjectCheckbox,
  getSearchDepthCheckbox,
  getSelectTargetDropdown,
} from './app.po';

function waitForProjectGraph(router: 'hash' | 'browser') {
  if (router === 'browser') {
    cy.wait('@getGraph');
  }
}

function waitForTaskGraphs(router: 'hash' | 'browser') {
  if (router === 'browser') {
    cy.wait('@getTaskGraphs');
  }
}

function resolveProjectsRoute(
  router: 'hash' | 'browser',
  route: string,
  paramString: string
) {
  if (router === 'hash') {
    return `/#${route}?${paramString}`;
  } else {
    return `${route}?${paramString}`;
  }
}

function resolveTasksRoute(
  router: 'hash' | 'browser',
  route: string,
  paramString: string
) {
  if (router === 'hash') {
    return `/#${route}?${paramString}`;
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
        cy.visit(resolveProjectsRoute(router, `${route}/cart`, ''));

        // wait for first graph to finish loading
        waitForProjectGraph(router);

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

      it('should focus projects with special characters', () => {
        cy.visit(
          resolveProjectsRoute(router, `${route}/%40scoped%2Fproject-a`, '')
        );

        // wait for first graph to finish loading
        waitForProjectGraph(router);

        const dependencies = nxExamplesJson.dependencies['@scoped/project-a'];
        const dependents = Object.keys(nxExamplesJson.dependencies).filter(
          (key) =>
            nxExamplesJson.dependencies[key]
              .map((dependencies) => dependencies.target)
              .includes('@scoped/project-a')
        );
        getCheckedProjectItems().should(
          'have.length',
          ['@scoped/project-a', ...dependencies, ...dependents].length
        );
      });

      it('should focus projects with search depth', () => {
        cy.visit(
          resolveProjectsRoute(router, `${route}/cart`, `searchDepth=2`)
        );

        // wait for first graph to finish loading
        waitForProjectGraph(router);

        getCheckedProjectItems().should('have.length', 10);
        getSearchDepthCheckbox().should('exist');
      });

      it('should focus projects with search depth disabled', () => {
        cy.visit(
          resolveProjectsRoute(router, `${route}/cart`, `searchDepth=0`)
        );

        // wait for first graph to finish loading
        waitForProjectGraph(router);

        getCheckedProjectItems().should('have.length', 12);
        getSearchDepthCheckbox().should('exist');
      });

      it('should set group by folder', () => {
        cy.visit(
          resolveProjectsRoute(router, `${route}/cart`, `groupByFolder=true`)
        );

        // wait for first graph to finish loading
        waitForProjectGraph(router);

        getGroupByFolderCheckbox().should('be.checked');
      });

      it('should select all projects', () => {
        cy.visit(resolveProjectsRoute(router, `${route}/all`, ``));

        // wait for first graph to finish loading
        waitForProjectGraph(router);

        getCheckedProjectItems().should(
          'have.length',
          nxExamplesJson.projects.length
        );
      });
    });
  });
}

export function testTaskRoutes(router: 'hash' | 'browser', routes: string[]) {
  routes.forEach((route) => {
    describe(`for route ${route}`, () => {
      it('should set group by project', () => {
        cy.visit(resolveTasksRoute(router, route, `groupByProject=true`));

        // wait for first graph to finish loading
        waitForProjectGraph(router);
        waitForTaskGraphs(router);

        getGroupByProjectCheckbox().should('be.checked');
      });

      it('should set selected target', () => {
        cy.visit(resolveTasksRoute(router, `${route}/e2e`, ''));

        // wait for first graph to finish loading
        waitForProjectGraph(router);
        waitForTaskGraphs(router);

        getSelectTargetDropdown().should('have.value', 'e2e');
      });

      it('should select all', () => {
        cy.visit(resolveTasksRoute(router, `${route}/e2e/all`, ''));

        // wait for first graph to finish loading
        waitForProjectGraph(router);
        waitForTaskGraphs(router);

        getSelectTargetDropdown().should('have.value', 'e2e');
        getCheckedProjectItems().should('have.length', 2);
      });
    });
  });
}
