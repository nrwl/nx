export const getSelectProjectsMessage = () => cy.get('#no-projects-chosen');
export const getGraph = () => cy.get('#graph-container');
export const getSelectAllButton = () => cy.get('[data-cy=selectAllButton]');
export const getDeselectAllButton = () => cy.get('[data-cy=deselectAllButton]');
export const getSelectAffectedButton = () => cy.get('[data-cy=affectedButton]');

export const getUnfocusProjectButton = () => cy.get('[data-cy=unfocusButton]');

export const getProjectItems = () => cy.get('[data-project]');

export const getCheckedProjectItems = () => cy.get('[data-active="true"]');
export const getUncheckedProjectItems = () => cy.get('[data-active="false"]');

export const getGroupByFolderCheckbox = () =>
  cy.get('input[name=displayOptions][value=groupByFolder]');

export const getSearchDepthCheckbox = () =>
  cy.get('input[name=depthFilter][value=depthFilterActivated]');
export const getTextFilterInput = () => cy.get('[data-cy=textFilterInput]');
export const getTextFilterReset = () => cy.get('[data-cy=textFilterReset]');

export const getSearchDepthDecrementButton = () =>
  cy.get('[data-cy=decrement-depth-filter]');
export const getSearchDepthIncrementButton = () =>
  cy.get('[data-cy=increment-depth-filter]');

export const getIncludeProjectsInPathButton = () =>
  cy.get('input[name=textFilterCheckbox]');

export const getImageDownloadButton = () =>
  cy.get('[data-cy=downloadImageButton]');
