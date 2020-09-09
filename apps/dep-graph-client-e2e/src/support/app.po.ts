export const getSelectProjectsMessage = () => cy.get('#no-projects-chosen');
export const getGraph = () => cy.get('#graph-container');
export const getSelectAllButton = () => cy.get('[data-cy=selectAllButton]');
export const getDeselectAllButton = () => cy.get('[data-cy=deselectAllButton]');
export const getUnfocusProjectButton = () => cy.get('[data-cy=unfocusButton]');

export const getProjectCheckboxes = () => cy.get('input[name=projectName]');

export const getCheckedProjectCheckboxes = () =>
  cy.get('input[name=projectName]:checked');
export const getUncheckedProjectCheckboxes = () =>
  cy.get('input[name=projectName]:not(:checked)');

export const getGroupByfolderCheckbox = () =>
  cy.get('input[name=displayOptions][value=groupByFolder]');

export const getTextFilterInput = () => cy.get('[data-cy=textFilterInput]');
export const getTextFilterButton = () => cy.get('[data-cy=textFilterButton]');
export const getIncludeProjectsInPathButton = () =>
  cy.get('input[name=textFilterCheckbox]');
