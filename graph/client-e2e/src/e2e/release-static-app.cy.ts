import { testProjectsRoutes, testTaskRoutes } from '../support/routing-tests';

describe('release static-mode app', () => {
  describe('smoke tests', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('should not display experimental features', () => {
      cy.get('experimental-features').should('not.exist');
    });

    it('should not display the debugger', () => {
      cy.get('debugger-panel').should('not.exist');
    });

    it('should use hash router', () => {
      cy.url().should('contain', '/#/projects');
    });
  });

  describe('routing', () => {
    testProjectsRoutes('hash', ['/projects']);
  });
});
