import {
  getCheckedProjectItems,
  getDeselectAllButton,
  getGroupByFolderCheckbox,
  getImageDownloadButton,
  getIncludeProjectsInPathButton,
  getProjectItems,
  getSearchDepthCheckbox,
  getSelectAffectedButton,
  getSelectAllButton,
  getSelectProjectsMessage,
  getTextFilterInput,
  getTextFilterReset,
  getUncheckedProjectItems,
  getUnfocusProjectButton,
} from '../support/app.po';

describe('dep-graph-client', () => {
  beforeEach(() => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/');

    // wait for first graph to finish loading
    cy.wait('@getGraph');
  });

  describe('select projects message', () => {
    it('should display on load', () => {
      getSelectProjectsMessage().should('be.visible');
    });

    it('should hide when a project is selected', () => {
      cy.contains('nx-dev').scrollIntoView().should('be.visible');
      cy.get('[data-project="nx-dev"]').should('be.visible');
      cy.get('[data-project="nx-dev"]').click({ force: true });
      getSelectProjectsMessage().should('not.exist');
    });
  });

  describe('text filter', () => {
    it('should hide clear button initially', () => {
      getTextFilterReset().should('not.exist');
    });

    it('should show clear button after typing', () => {
      getTextFilterInput().type('nx-dev');
      getTextFilterReset().should('exist');
    });

    it('should hide clear button after clicking', () => {
      getTextFilterInput().type('nx-dev');
      getTextFilterReset().click().should('not.exist');
    });

    it('should filter projects', () => {
      getTextFilterInput().type('nx-dev');
      getCheckedProjectItems().should('have.length', 9);
    });

    it('should clear selection on reset', () => {
      getTextFilterInput().type('nx-dev');
      getCheckedProjectItems().should('have.length', 9);
      getTextFilterReset().click();
      getCheckedProjectItems().should('have.length', 0);
    });
  });

  describe('selecting a different project', () => {
    it('should change the available projects', () => {
      getProjectItems().should('have.length', 53);
      cy.get('[data-cy=project-select]').select('Ocean', { force: true });
      getProjectItems().should('have.length', 124);
    });
  });

  describe('select all button', () => {
    it('should check all project items', () => {
      getSelectAllButton().scrollIntoView().click({ force: true });
      getCheckedProjectItems().should('have.length', 53);
    });
  });

  describe('deselect all button', () => {
    it('should uncheck all project items', () => {
      getDeselectAllButton().click();
      getUncheckedProjectItems().should('have.length', 53);
      getSelectProjectsMessage().should('be.visible');
    });
  });

  describe('show affected button', () => {
    it('should be hidden initially', () => {
      getSelectAffectedButton().should('not.exist');
    });

    it('should check all affected project items', () => {
      cy.get('[data-cy=project-select]').select('Affected', { force: true });
      cy.wait('@getGraph');
      getSelectAffectedButton().click();

      getCheckedProjectItems().should('have.length', 5);
    });
  });

  describe('selecting projects', () => {
    it('should select a project by clicking on the project name', () => {
      cy.get('[data-project="nx-dev"]').should('have.data', 'active', false);
      cy.get('[data-project="nx-dev"]').click({
        force: true,
      });

      cy.get('[data-project="nx-dev"][data-active="true"]').should('exist');
    });

    it('should deselect a project by clicking on the project name again', () => {
      cy.get('[data-project="nx-dev"][data-active="false"]').click({
        force: true,
      });
      cy.get('[data-project="nx-dev"][data-active="true"]')
        .should('exist')
        .click({
          force: true,
        });
      cy.get('[data-project="nx-dev"][data-active="false"]').should('exist');
    });

    it('should select a project by clicking on the selected icon', () => {
      cy.get('[data-project="nx-dev"][data-active="false"]').click({
        force: true,
      });
      cy.get('[data-project="nx-dev"][data-active="true"]')
        .should('exist')
        .parent()
        .siblings()
        .first()
        .should('exist')
        .click({
          force: true,
        });
      cy.get('[data-project="nx-dev"][data-active="false"]').should('exist');
    });
  });

  describe('focusing projects in sidebar', () => {
    it('should select appropriate projects', () => {
      cy.contains('nx-dev').scrollIntoView().should('be.visible');
      cy.get('[data-project="nx-dev"]').prev('button').click({ force: true });

      getCheckedProjectItems().should('have.length', 10);
    });
  });

  describe('unfocus button', () => {
    it('should uncheck all project items', () => {
      cy.get('[data-project="nx-dev"]').prev('button').click({ force: true });
      getUnfocusProjectButton().click();

      getUncheckedProjectItems().should('have.length', 53);
    });
  });

  describe('text filtering', () => {
    it('should filter projects by text when pressing enter', () => {
      getTextFilterInput().type('nx-dev{enter}');

      getCheckedProjectItems().should('have.length', 9);
    });

    it('should include projects in path when option is checked', () => {
      getTextFilterInput().type('nx-dev');
      getIncludeProjectsInPathButton().click();

      getCheckedProjectItems().should('have.length', 17);
    });
  });

  describe('image download button', () => {
    it('should be hidden initally', () => {
      getImageDownloadButton().should('have.class', 'opacity-0');
    });

    it('should be shown when a project is selected', () => {
      cy.get('[data-project="nx-dev"]').prev('button').click({ force: true });
      getImageDownloadButton().should('not.have.class', 'opacity-0');
    });

    it('should be hidden when no more projects are selected', () => {
      cy.get('[data-project="nx-dev"]').prev('button').click({ force: true });
      getDeselectAllButton().click();
      getImageDownloadButton().should('have.class', 'opacity-0');
    });
  });

  describe('setting url params', () => {
    it('should set focused project', () => {
      cy.contains('nx-dev').scrollIntoView().should('be.visible');
      cy.get('[data-project="nx-dev"]').prev('button').click({ force: true });

      cy.url().should('contain', 'focus=nx-dev');
    });

    it('should set group by folder', () => {
      getGroupByFolderCheckbox().click();

      cy.url().should('contain', 'groupByFolder=true');
    });

    it('should set search depth', () => {
      getSearchDepthCheckbox().click();

      cy.url().should('contain', 'searchDepth=1');
    });

    it('should set select to all', () => {
      getSelectAllButton().click();

      cy.url().should('contain', 'select=all');
    });
  });
});

describe('loading dep-graph client with url params', () => {
  it('should focus projects', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?focus=nx-dev');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getCheckedProjectItems().should('have.length', 10);
  });

  it('should focus projects with search depth', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?focus=nx-dev&searchDepth=1');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getCheckedProjectItems().should('have.length', 8);
    getSearchDepthCheckbox().should('exist');
  });

  it('should set group by folder', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?focus=nx-dev&searchDepth=1&groupByFolder=true');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getGroupByFolderCheckbox().should('be.checked');
  });

  it('should select all projects', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?select=all');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getCheckedProjectItems().should('have.length', 53);
  });
});
