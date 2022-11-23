import {
  getCheckedProjectItems,
  getDeselectAllButton,
  getFocusButtonForProject,
  getGroupByFolderCheckbox,
  getImageDownloadButton,
  getIncludeProjectsInPathButton,
  getSearchDepthCheckbox,
  getSearchDepthIncrementButton,
  getSelectAffectedButton,
  getSelectAllButton,
  getSelectProjectsMessage,
  getTextFilterInput,
  getTextFilterReset,
  getToggleAllButtonForFolder,
  getUncheckedProjectItems,
  getUnfocusProjectButton,
} from '../support/app.po';

import * as affectedJson from '../fixtures/affected.json';
import { testProjectsRoutes } from '../support/routing-tests';
import * as nxExamplesJson from '../fixtures/nx-examples-project-graph.json';

describe('dev mode - project graph', () => {
  before(() => {
    cy.intercept('/assets/project-graphs/e2e.json', {
      fixture: 'nx-examples-project-graph.json',
    }).as('getGraph');
    cy.visit('/');

    // wait for initial graph to finish loading
    cy.wait('@getGraph');
  });

  afterEach(() => {
    // clean up by hiding all projects and clearing text input
    getDeselectAllButton().click();
    getTextFilterInput().clear();
    getCheckedProjectItems().should('have.length', 0);
  });

  describe('select projects message', () => {
    it('should display on load', () => {
      getSelectProjectsMessage().should('be.visible');
    });

    it('should hide when a project is selected', () => {
      cy.contains('cart').scrollIntoView().should('be.visible');
      cy.get('[data-project="cart"]').should('be.visible');
      cy.get('[data-project="cart"]').click({ force: true });
      getSelectProjectsMessage().should('not.exist');
    });
  });

  describe('text filter', () => {
    it('should hide clear button initially', () => {
      getTextFilterReset().should('not.exist');
    });

    it('should show clear button after typing', () => {
      getTextFilterInput().type('cart');
      getTextFilterReset().should('exist');
    });

    it('should clear selection on reset', () => {
      getTextFilterInput().type('cart');
      getCheckedProjectItems().should(
        'have.length',
        nxExamplesJson.projects.filter((project) =>
          project.name.includes('cart')
        ).length
      );
      getTextFilterReset().click();
      getCheckedProjectItems().should('have.length', 0);
    });

    it('should hide clear button after clicking', () => {
      getTextFilterInput().type('cart');
      getTextFilterReset().click().should('not.exist');
    });

    it('should filter projects by text when pressing enter', () => {
      getTextFilterInput().type('cart{enter}');

      getCheckedProjectItems().should(
        'have.length',
        nxExamplesJson.projects.filter((project) =>
          project.name.includes('cart')
        ).length
      );
    });

    it('should filter projects by text after debounce', () => {
      getTextFilterInput().type('cart');
      getCheckedProjectItems().should(
        'have.length',
        nxExamplesJson.projects.filter((project) =>
          project.name.includes('cart')
        ).length
      );
    });

    it('should include projects in path when option is checked', () => {
      getTextFilterInput().type('cart');
      getIncludeProjectsInPathButton().click();

      getCheckedProjectItems().should(
        'have.length.gt',
        nxExamplesJson.projects.filter((project) =>
          project.name.includes('cart')
        ).length
      );
    });
  });

  describe('select all button', () => {
    it('should check all project items', () => {
      getSelectAllButton().scrollIntoView().click({ force: true });
      getCheckedProjectItems().should(
        'have.length',
        nxExamplesJson.projects.length
      );
    });
  });

  describe('deselect all button', () => {
    it('should uncheck all project items', () => {
      getDeselectAllButton().click();
      getUncheckedProjectItems().should(
        'have.length',
        nxExamplesJson.projects.length
      );
      getSelectProjectsMessage().should('be.visible');
    });
  });

  describe('show affected button', () => {
    it('should be hidden initially', () => {
      getSelectAffectedButton().should('not.exist');
    });

    it('should check all affected project items', () => {
      cy.intercept('/assets/project-graphs/affected.json', {
        fixture: 'affected.json',
      }).as('getAffectedGraph');

      cy.get('[data-cy=project-select]').select('affected', { force: true });

      cy.wait('@getAffectedGraph');
      getSelectAffectedButton().click();

      getCheckedProjectItems().should(
        'have.length',
        affectedJson.affected.length
      );

      // switch back to Nx Examples graph before proceeding
      cy.intercept('/assets/project-graphs/e2e.json', {
        fixture: 'nx-examples-project-graph.json',
      }).as('getGraph');
      cy.get('[data-cy=project-select]').select('e2e', { force: true });
      cy.wait('@getGraph');
    });
  });

  describe('selecting projects', () => {
    it('should select a project by clicking on the project name', () => {
      cy.get('[data-project="cart"]').should('have.data', 'active', false);
      cy.get('[data-project="cart"]').click({
        force: true,
      });

      cy.get('[data-project="cart"][data-active="true"]').should('exist');
    });

    it('should deselect a project by clicking on the project name again', () => {
      cy.get('[data-project="cart"]').click({
        force: true,
      });

      cy.get('[data-project="cart"][data-active="true"]')
        .should('exist')
        .click({
          force: true,
        });
      cy.get('[data-project="cart"][data-active="false"]').should('exist');
    });

    it('should select a project by clicking on the selected icon', () => {
      cy.get('[data-project="cart"][data-active="false"]').click({
        force: true,
      });
      cy.get('[data-project="cart"][data-active="true"]')
        .should('exist')
        .parent()
        .siblings()
        .first()
        .should('exist')
        .click({
          force: true,
        });
      cy.get('[data-project="cart"][data-active="false"]').should('exist');
    });
  });

  describe('focusing projects in sidebar', () => {
    it('should select appropriate projects', () => {
      cy.contains('cart').scrollIntoView().should('be.visible');
      getFocusButtonForProject('cart').click({ force: true });

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
  });

  describe('unfocus button', () => {
    it('should uncheck all project items', () => {
      getFocusButtonForProject('cart').click({ force: true });
      getUnfocusProjectButton().click();

      getCheckedProjectItems().should('have.length', 0);
    });
  });

  describe('toggle all projects in folder button', () => {
    it('should check all projects in folder if at least one project checked', () => {
      cy.contains('shared-product-state').scrollIntoView().should('be.visible');
      cy.get('[data-project="shared-product-state"]').should('be.visible');
      cy.get('[data-project="shared-product-state"]').click({ force: true });
      getToggleAllButtonForFolder('shared/product').click({ force: true });
      getCheckedProjectItems().should('have.length', 4);
    });

    it('should check all projects in folder if no projects checked yet', () => {
      getToggleAllButtonForFolder('shared').click({ force: true });
      getCheckedProjectItems().should('have.length', 5);
    });

    it('should uncheck all projects in folder if all projects checked yet', () => {
      getToggleAllButtonForFolder('shared').click({ force: true });
      getCheckedProjectItems().should('have.length', 5);
      getToggleAllButtonForFolder('shared').click({ force: true });
      getCheckedProjectItems().should('have.length', 0);
    });
  });

  describe('image download button', () => {
    it('should be hidden initally', () => {
      getImageDownloadButton().should('have.class', 'opacity-0');
    });

    it('should be shown when a project is selected', () => {
      cy.get('[data-project="cart"]').click({ force: true });
      getImageDownloadButton().should('not.have.class', 'opacity-0');
    });

    it('should be hidden when no more projects are selected', () => {
      cy.get('[data-project="cart"]').click({ force: true });
      getDeselectAllButton().click();
      getImageDownloadButton().should('have.class', 'opacity-0');
    });
  });

  describe('setting url params', () => {
    it('should set focused project', () => {
      cy.contains('cart').scrollIntoView().should('be.visible');
      getFocusButtonForProject('cart').click({ force: true });

      cy.url().should('contain', 'focus=cart');
    });

    it('should set group by folder', () => {
      getGroupByFolderCheckbox().click();

      cy.url().should('contain', 'groupByFolder=true');
    });

    it('should set search depth disabled', () => {
      // it's on by default, clicking should disable it
      getSearchDepthCheckbox().click();

      cy.url().should('contain', 'searchDepth=0');
    });

    it('should set search depth if greater than 1', () => {
      // it's on by default and set to 1, clicking should change it to 2
      getSearchDepthIncrementButton().click();

      cy.url().should('contain', 'searchDepth=2');
    });

    it('should set select to all', () => {
      getSelectAllButton().click();

      cy.url().should('contain', 'select=all');
    });
  });
});

describe('loading graph client with url params', () => {
  beforeEach(() => {
    cy.intercept('/assets/project-graphs/*', {
      fixture: 'nx-examples-project-graph.json',
    }).as('getGraph');
  });

  // check that params work from old base url of /
  // and also new /projects route
  testProjectsRoutes('browser', ['/', '/e2e/projects']);
});
