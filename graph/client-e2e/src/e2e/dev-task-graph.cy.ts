import {
  getCheckedProjectItems,
  getDeselectAllButton,
  getFocusButtonForProject,
  getGroupByFolderCheckbox,
  getGroupByProjectCheckbox,
  getImageDownloadButton,
  getIncludeProjectsInPathButton,
  getSearchDepthCheckbox,
  getSearchDepthIncrementButton,
  getSelectAffectedButton,
  getSelectAllButton,
  getSelectProjectsMessage,
  getSelectTargetDropdown,
  getSelectTasksMessage,
  getTextFilterInput,
  getTextFilterReset,
  getToggleAllButtonForFolder,
  getUncheckedProjectItems,
  getUnfocusProjectButton,
} from '../support/app.po';

import * as affectedJson from '../fixtures/affected.json';
import { testProjectsRoutes, testTaskRoutes } from '../support/routing-tests';
import * as nxExamplesJson from '../fixtures/nx-examples-project-graph.json';

describe('dev mode - task graph', () => {
  before(() => {
    cy.intercept('/assets/project-graphs/e2e.json', {
      fixture: 'nx-examples-project-graph.json',
    }).as('getGraph');

    cy.intercept('/assets/task-graphs/e2e.json', {
      fixture: 'nx-examples-task-graphs.json',
    }).as('getTaskGraph');

    cy.visit('/e2e/tasks');

    // wait for initial graphs to finish loading
    cy.wait('@getGraph');
    cy.wait('@getTaskGraph');
  });

  afterEach(() => {
    // clean up by hiding all tasks
    getDeselectAllButton().click();
    getCheckedProjectItems().should('have.length', 0);
  });

  describe('select tasks message', () => {
    it('should display on load', () => {
      getSelectTasksMessage().should('be.visible');
    });

    it('should hide when a project is selected', () => {
      cy.contains('cart').scrollIntoView().should('be.visible');
      cy.get('[data-project="cart"]').should('be.visible');
      cy.get('[data-project="cart"]').click({ force: true });
      getSelectTasksMessage().should('not.exist');
    });
  });

  describe('select all button', () => {
    it('should check all project items', () => {
      getSelectAllButton().scrollIntoView().click({ force: true });
      getCheckedProjectItems().should('have.length', 2);
    });

    it('should remove all from the url when no longer selected', () => {
      getSelectAllButton().scrollIntoView().click({ force: true });

      cy.url().should('contain', '/all');

      getDeselectAllButton().click();

      cy.url().should('not.contain', '/all');

      getSelectAllButton().scrollIntoView().click({ force: true });

      cy.url().should('contain', '/all');

      cy.get('[data-project="cart"]').click({
        force: true,
      });

      cy.url().should('not.contain', '/all');
    });
  });

  describe('deselect all button', () => {
    it('should uncheck all project items', () => {
      getDeselectAllButton().click();
      getUncheckedProjectItems().should('have.length', 2);
      getSelectTasksMessage().should('be.visible');
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

  describe('setting route params', () => {
    it('should set selected target', () => {
      getSelectTargetDropdown().select('e2e', { force: true });

      cy.url().should('contain', 'tasks/e2e');
    });

    it('should set group by project', () => {
      getGroupByProjectCheckbox().click();

      cy.url().should('contain', 'groupByProject=true');
    });
  });

  describe('loading graph client with url params', () => {
    beforeEach(() => {
      cy.intercept('/assets/project-graphs/*', {
        fixture: 'nx-examples-project-graph.json',
      }).as('getGraph');

      cy.intercept('/assets/task-graphs/e2e.json', {
        fixture: 'nx-examples-task-graphs.json',
      }).as('getTaskGraphs');
    });

    // check that params work from old base url of /
    // and also new /projects route
    testTaskRoutes('browser', ['/e2e/tasks']);
  });
});
