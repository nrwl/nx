import { testProjectsRoutes } from '../support/routing-tests';

describe('graph-client release', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should not display experimental features', () => {
    cy.get('experimental-features').should('not.exist');
  });

  it('should not display the debugger', () => {
    cy.get('debugger-panel').should('not.exist');
  });

  describe('routing', () => {
    it('should use hash router', () => {
      cy.url().should('contain', '/#/projects');
    });

    testProjectsRoutes('hash', ['/projects']);
  });
});
