import {
  getCheckedProjectItems,
  getDeselectAllButton,
  getFocusButtonForProject,
  getGroupByFolderCheckbox,
  getImageDownloadButton,
  getIncludeProjectsInPathButton,
  getProjectItems,
  getSearchDepthCheckbox,
  getSearchDepthIncrementButton,
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
      getCheckedProjectItems().should('have.length', 15);
    });

    it('should clear selection on reset', () => {
      getTextFilterInput().type('nx-dev');
      getCheckedProjectItems().should('have.length', 15);
      getTextFilterReset().click();
      getCheckedProjectItems().should('have.length', 0);
    });
  });

  describe('selecting a different project', () => {
    it('should change the available projects', () => {
      getProjectItems().should('have.length', 62);
      cy.get('[data-cy=project-select]').select('Ocean', { force: true });
      getProjectItems().should('have.length', 124);
    });
  });

  describe('select all button', () => {
    it('should check all project items', () => {
      getSelectAllButton().scrollIntoView().click({ force: true });
      getCheckedProjectItems().should('have.length', 62);
    });
  });

  describe('deselect all button', () => {
    it('should uncheck all project items', () => {
      getDeselectAllButton().click();
      getUncheckedProjectItems().should('have.length', 62);
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
      getFocusButtonForProject('nx-dev').click({ force: true });

      getCheckedProjectItems().should('have.length', 11);
    });
  });

  describe('unfocus button', () => {
    it('should uncheck all project items', () => {
      getFocusButtonForProject('nx-dev').click({ force: true });
      getUnfocusProjectButton().click();

      getUncheckedProjectItems().should('have.length', 62);
    });
  });

  describe('text filtering', () => {
    it('should filter projects by text when pressing enter', () => {
      getTextFilterInput().type('nx-dev{enter}');

      getCheckedProjectItems().should('have.length', 15);
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
      cy.get('[data-project="nx-dev"]').click({ force: true });
      getImageDownloadButton().should('not.have.class', 'opacity-0');
    });

    it('should be hidden when no more projects are selected', () => {
      cy.get('[data-project="nx-dev"]').click({ force: true });
      getDeselectAllButton().click();
      getImageDownloadButton().should('have.class', 'opacity-0');
    });
  });

  describe('setting url params', () => {
    it('should set focused project', () => {
      cy.contains('nx-dev').scrollIntoView().should('be.visible');
      getFocusButtonForProject('nx-dev').click({ force: true });

      cy.url().should('contain', 'focus=nx-dev');
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

describe('loading dep-graph client with url params', () => {
  it('should focus projects', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?focus=nx-dev');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getCheckedProjectItems().should('have.length', 11);
  });

  it('should focus projects with search depth', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?focus=nx-dev&searchDepth=2');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getCheckedProjectItems().should('have.length', 15);
    getSearchDepthCheckbox().should('exist');
  });

  it('should focus projects with search depth disabled', () => {
    cy.intercept('/assets/graphs/*').as('getGraph');

    cy.visit('/?focus=nx-dev&searchDepth=0');

    // wait for first graph to finish loading
    cy.wait('@getGraph');

    getCheckedProjectItems().should('have.length', 15);
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

    getCheckedProjectItems().should('have.length', 62);
  });
});

describe('theme preferences', () => {
  let systemTheme: string;
  beforeEach(() => {
    cy.visit('/');
    systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });
  it('should initialize localstorage with default theme', () => {
    expect(localStorage.getItem('nx-dep-graph-theme')).eq('system');
  });

  it('has system default theme', () => {
    cy.log('system theme is:', systemTheme);
    cy.get('html').should('have.class', systemTheme);
  });

  describe('dark theme is set as prefered', () => {
    before(() => {
      cy.get('[data-cy="theme-open-modal-button"]').click();
      cy.get('[data-cy="dark-theme-button"]').click();
    });

    it('should set dark theme', () => {
      cy.log('Localstorage is: ', localStorage.getItem('nx-dep-graph-theme'));
      expect(localStorage.getItem('nx-dep-graph-theme')).eq('dark');
      cy.get('html').should('have.class', 'dark');
    });
  });

  describe('light theme is set as preferred', () => {
    before(() => {
      cy.get('[data-cy="theme-open-modal-button"]').click();
      cy.get('[data-cy="light-theme-button"]').click();
    });

    it('should set light theme', () => {
      cy.log('Localstorage is: ', localStorage.getItem('nx-dep-graph-theme'));
      expect(localStorage.getItem('nx-dep-graph-theme')).eq('light');
      cy.get('html').should('have.class', 'light');
    });
  });
});
