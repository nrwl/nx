export const getSelectProjectsMessage = () =>
  cy.contains('Please select a project in the sidebar');
export const getSelectTasksMessage = () =>
  cy.contains('Please select a task in the sidebar');
export const getGraph = () => cy.get('#graph-container');

export function waitForGraphLoad() {
  cy.get('#cytoscape-graph', { timeout: 15000 }).should('exist');
}

export function selectProjectInSidebar(projectName: string) {
  cy.contains('span.font-mono', projectName)
    .scrollIntoView()
    .should('be.visible')
    .click({ force: true });
}
export const getSelectAllButton = () => cy.get('[data-cy=selectAllButton]');
export const getDeselectAllButton = () => cy.get('[data-cy=deselectAllButton]');
export const getSelectAffectedButton = () => cy.get('[data-cy=affectedButton]');

export const getUnfocusProjectButton = () => cy.get('[data-cy=unfocusButton]');

export const getProjectItems = () =>
  cy.get('[data-project]', { timeout: 6000 });

export const getCheckedProjectItems = () => cy.get('[data-active="true"]');
export const getUncheckedProjectItems = () => cy.get('[data-active="false"]');

export const getGroupByFolderCheckbox = () =>
  cy.get('input[name=groupByFolder]');

export const getGroupByProjectCheckbox = () =>
  cy.get('input[name=groupByProject]');

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

export const getFocusButtonForProject = (projectName: string) =>
  cy.get(`[data-cy="focus-button-${projectName}"]`);

export const getToggleAllButtonForFolder = (folderName: string) =>
  cy.get(`[data-cy="toggle-folder-visibility-button-${folderName}"]`);

export const getSelectTargetDropdown = () =>
  cy.get('[data-cy=selected-target-dropdown]');

export const openTooltipForNode = (nodeId: string) =>
  cy.window().then((window) => {
    // @ts-ignore - we will access private methods only in this e2e test
    const pos = window.externalApi._graphService.renderGraph.cy
      .$(nodeId)
      .renderedPosition();
    cy.get('#cytoscape-graph').click(pos.x, pos.y);
  });

export function waitForGraphWheelTestApi() {
  cy.window().should((window) => {
    expect(window.__NX_GRAPH_TEST__).to.exist;
    expect(window.__NX_GRAPH_TEST__?.getWheelSensitivity()).to.be.a('number');
  });
}

export function getGraphWheelSensitivityTestApi() {
  return cy.window().its('__NX_GRAPH_TEST__');
}
