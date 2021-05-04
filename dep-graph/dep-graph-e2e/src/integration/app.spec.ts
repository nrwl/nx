import {
  getDeselectAllButton,
  getUnfocusProjectButton,
  getProjectCheckboxes,
  getCheckedProjectCheckboxes,
  getSelectAllButton,
  getSelectProjectsMessage,
  getTextFilterInput,
  getTextFilterButton,
  getIncludeProjectsInPathButton,
} from '../support/app.po';

describe('dep-graph-client', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('[data-cy=project-select]').select('Ocean');
  });

  it('should toggle the sidebar', () => {
    cy.get('#sidebar').should('be.visible');
    cy.get('#sidebar-toggle-button').click();
    cy.get('#sidebar').should('not.be.visible');
  });

  it('should display message to select projects', () => {
    getSelectProjectsMessage().should('be.visible');
  });

  describe('select all button', () => {
    it('should check all project checkboxes', () => {
      getSelectAllButton().click();
      getProjectCheckboxes().should('be.checked');
    });
  });

  describe('deselect all button', () => {
    it('should uncheck all project checkboxes', () => {
      getDeselectAllButton().click();
      getProjectCheckboxes().should('not.be.checked');
    });
  });

  describe('focusing projects in sidebar', () => {
    it('should select appropriate projects', () => {
      cy.contains('nx-docs-site').siblings('button').click();

      getCheckedProjectCheckboxes().should('have.length', 16);
      cy.contains('nx-docs-site-e2e').children('input').should('be.checked');
      cy.contains('common-platform').children('input').should('be.checked');
      cy.contains('private-nx-cloud')
        .children('input')
        .should('not.be.checked');
    });
  });

  describe('unfocus button', () => {
    it('should uncheck all project checkboxes', () => {
      cy.contains('nx-docs-site').siblings('button').click();
      getUnfocusProjectButton().click();

      getProjectCheckboxes().should('not.be.checked');
    });
  });

  describe('text filtering', () => {
    it('should filter projects by text when clicked', () => {
      getTextFilterInput().type('nx-docs-site');
      getTextFilterButton().click();

      getCheckedProjectCheckboxes().should('have.length', 11);
    });

    it('should filter projects by text when pressing enter', () => {
      getTextFilterInput().type('nx-docs-site{enter}');

      getCheckedProjectCheckboxes().should('have.length', 11);
    });

    it('should include projects in path when option is checked', () => {
      getTextFilterInput().type('nx-docs-site');
      getIncludeProjectsInPathButton().click();
      getTextFilterButton().click();

      getCheckedProjectCheckboxes().should('have.length', 16);
    });
  });
});
