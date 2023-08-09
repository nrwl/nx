import {
  getCheckedProjectItems,
  getFocusButtonForProject,
  openTooltipForNode,
} from '../support/app.po';

describe('nx-console environment', () => {
  let fileClickEvents = [];
  let openProjectEvents = [];
  let runTaskEvents = [];
  beforeEach(() => {
    fileClickEvents = [];
    openProjectEvents = [];
    runTaskEvents = [];

    cy.visit('/');
    cy.window().then((win) => {
      win.externalApi.registerFileClickCallback((url) =>
        fileClickEvents.push(url)
      );
      win.externalApi.registerOpenProjectConfigCallback((projectName) =>
        openProjectEvents.push(projectName)
      );
      win.externalApi.registerRunTaskCallback((taskId) =>
        runTaskEvents.push(taskId)
      );
    });
  });

  describe('tooltips', () => {
    it('should show open project button and send correct event', () => {
      cy.window().then((win) => win.externalApi.focusProject('cart'));
      cy.get('#focused-project-name').should('contain.text', 'cart');
      openTooltipForNode('#cart');

      cy.get('[data-cy="project-open-config-button"]').should('be.visible');
      cy.get('[data-cy="project-open-config-button"]')
        .click()
        .then(() => {
          expect(openProjectEvents).to.have.length(1);
        });
    });

    it('should show clickable edge file links and send correct event', () => {
      cy.window().then((win) => win.externalApi.focusProject('cart'));
      cy.get('#focused-project-name').should('contain.text', 'cart');

      openTooltipForNode('edge[source = "cart"][target = "cart-cart-page"]');
      cy.get('[data-cy="project-edge-file-entry"]').should(
        'have.length.above',
        0
      );
      cy.get('[data-cy="project-edge-file-entry"]')
        .first()
        .click()
        .then(() => {
          expect(fileClickEvents).to.have.length(1);
        });
    });

    it('should show run task button and send correct event', () => {
      cy.window().then((win) => win.externalApi.focusProject('cart'));
      cy.window().then((win) =>
        win.externalApi.router.navigate('/tasks/build')
      );
      cy.get('[data-project="cart"]').click({
        force: true,
      });

      openTooltipForNode('[id = "cart:build:production"]');

      cy.get('[data-cy="task-run-button"]').should('be.visible');
      cy.get('[data-cy="task-run-button"]')
        .click()
        .then(() => {
          expect(runTaskEvents).to.have.length(1);
        });
    });
  });
});
