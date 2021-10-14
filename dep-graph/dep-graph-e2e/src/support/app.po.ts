export const getSelectProjectsMessage = () => cy.get('#no-projects-chosen');
export const getGraph = () => cy.get('#graph-container');
export const getSelectAllButton = () => cy.get('[data-cy=selectAllButton]');
export const getDeselectAllButton = () => cy.get('[data-cy=deselectAllButton]');
export const getUnfocusProjectButton = () => cy.get('[data-cy=unfocusButton]');

export const getProjectItems = () => cy.get('[data-project]');

export const getCheckedProjectItems = () => cy.get('[data-active="true"]');
export const getUncheckedProjectItems = () => cy.get('[data-active="false"]');

export const getGroupByfolderItems = () =>
  cy.get('input[name=displayOptions][value=groupByFolder]');

export const getTextFilterInput = () => cy.get('[data-cy=textFilterInput]');
export const getIncludeProjectsInPathButton = () =>
  cy.get('input[name=textFilterCheckbox]');
